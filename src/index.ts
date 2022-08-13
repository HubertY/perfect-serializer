class Registry<T = object>{
    forward: { [s: string]: T };
    backward: Map<T, string>;
    register(key: string, value: T) {
        this.forward[key] = value;
        this.backward.set(value, key);
        return key;
    }
    get(key: string) {
        return this.forward[key];
    }
    getKey(obj: T) {
        return this.backward.get(obj);
    }
    constructor() {
        this.forward = {};
        this.backward = new Map();
    }
}

class NumericRegistry<T = object>{
    forward: T[];
    backward: Map<T, number>;
    register(value: T) {
        this.backward.set(value, this.forward.length);
        this.forward.push(value);
        return this.forward.length - 1;
    }
    get(key: number) {
        return this.forward[key];
    }
    getKey(obj: T) {
        return this.backward.get(obj);
    }
    constructor(data: T[] = []) {
        this.forward = data;
        this.backward = new Map();
        for (let i = 0; i < this.forward.length; i++) {
            this.backward.set(this.forward[i], i);
        }
    }
}


type CustomSerializer<T, S> = { encode: (arg: T, serial: Function) => S, initialize: (proto: ValidPrototype) => T, decode: (item: T, arg: S, deref: (s: SerializeReturn) => any, decode?: DeferredLookup) => void };
type AnyCustomSerializer = CustomSerializer<any, any>

type DeferredLookup = (value: any, cb: (item: any) => void) => void;

const defaultSerializer = {
    encode(item, _serialize) {
        let ret = {} as { [key: string]: compressedPropDesc };
        if (Object.getOwnPropertySymbols(item).length) {
            throw new TypeError(`unregistered object ${item} has symbol properties!`);
        }
        for (let prop of Object.getOwnPropertyNames(item)) {
            const desc = Object.getOwnPropertyDescriptor(item, prop)!;
            if (desc.get || desc.set) {
                throw new ReferenceError(`unregistered object ${item} has getter or setter defined for prop ${prop}`);
            }
            else {
                desc.value = _serialize(desc.value);
                ret[prop] = compressPropertyDescriptor(desc);
            }
        }
        return ret;
    },
    initialize(proto) {
        return Object.create(proto);
    },
    decode(obj, data, lookup) {
        for (let prop of Object.keys(data as { [key: string]: compressedPropDesc })) {
            const desc = (data as { [key: string]: compressedPropDesc })[prop];
            const wec = desc[1] ? desc[1] : WriteableEnumerableConfigurable.TTT;
            let descriptor = decodeDescriptorParams(wec);
            const content = desc[0];
            descriptor.value = lookup(content);
            Object.defineProperty(obj, prop, descriptor);
        }
    }

} as CustomSerializer<any, { [key: string]: compressedPropDesc }>;

function deserialize(item: SerializeReturn, globalRegistry: Registry<Function | object>, objectRegistry: objLit[], custom: Map<ValidPrototype, AnyCustomSerializer> = new Map()) {
    const built = objectRegistry.map(() => undefined) as any[];
    const serials = [] as CustomSerializer<any, any>[];
    //const callbacks = objectRegistry.map(() => new Map()) as Map<number, Function>[];
    //const waits = objectRegistry.map(() => new Set()) as Set<Function>[];

    const deGlobalRef = (key: string) => {
        let lookup = globalRegistry.get(key);
        if (lookup !== undefined) {
            return lookup;
        }
        else {
            throw new ReferenceError(`global ref ${key} not found!`);
        }
    }

    const deLocalRef = (key: number) => {
        if (built[key]) {
            return built[key];
        }
        else {
            throw RangeError("object isn't built yet!");
        }
    }

    function protoCycle(i: number) {
        if (built[i] === undefined) {
            built[i] = null;
            const schema = objectRegistry[i];
            let proto = (() => {
                if (schema.length === 1) {
                    return Object.prototype;
                }
                else if (schema[1] === null) {
                    return null;
                }
                const ref = schema[1][0];
                if (typeof ref === "string") {
                    return deGlobalRef(ref);
                }
                else if (typeof ref === "number") {
                    return protoCycle(ref);
                }
            })();

            serials[i] = custom.has(proto) ? custom.get(proto)! : defaultSerializer;

            //todo: default safety check on prototype chain for [native code]
            built[i] = serials[i].initialize(proto);
            return built[i];
        }
        else if (built[i] === null) {
            throw new ReferenceError("circular prototype chain!");
        }
        else {
            return built[i];
        }
    }

    for (let i = 0; i < built.length; i++) {
        protoCycle(i);
    }

    function lookup(item: SerializeReturn) {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item == null) {
            return item;
        }
        else if (item.length === 0) {
            return undefined;
        }
        const key = item[0];
        if (typeof key === "string") {
            return deGlobalRef(key);
        }
        else if (typeof key === "number") {
            return deLocalRef(key);
        }
        else {
            throw TypeError("parse failed");
        }
    }

    for (let i = 0; i < built.length; i++) {
        const data = objectRegistry[i][0]
        const serial = serials[i]
        serial.decode(built[i], data, lookup);
    }
    return lookup(item);
}

enum WriteableEnumerableConfigurable {
    TTT = 0,
    TTF = 1,
    TFT = 2,
    TFF = 3,
    FTT = 4,
    FTF = 5,
    FFT = 6,
    FFF = 7
}
type globalRef = [string];
type localRef = [number];
type Ref = globalRef | localRef;
type undef = [];
type objLit = [{ [key: string]: compressedPropDesc }] | [{ [key: string]: compressedPropDesc }, Ref | null] | [SerializeReturn, globalRef];
type compressedPropDesc = [SerializeReturn] | [SerializeReturn, WriteableEnumerableConfigurable]

type SerializeReturn = undef | null | globalRef | localRef | string | boolean | number;

type ValidPrototype = object | Function | null;

function decodeDescriptorParams(i: WriteableEnumerableConfigurable): PropertyDescriptor {
    let ret = { writeable: true, enumerable: true, configurable: true }
    if (i >= 4) {
        i -= 4;
        ret.writeable = false;
    }
    if (i >= 2) {
        i -= 2;
        ret.enumerable = false;
    }
    if (i >= 1) {
        ret.writeable = false;
    }
    return ret;
}

function compressPropertyDescriptor(d: PropertyDescriptor): compressedPropDesc {
    let i = WriteableEnumerableConfigurable.TTT;
    if (!d.configurable) {
        i += 1;
    }
    if (!d.enumerable) {
        i += 2;
    }
    if (!d.writable) {
        i += 4;
    }
    if (i === WriteableEnumerableConfigurable.TTT) {
        return [d.value];
    }
    else {
        return [d.value, i];
    }
}

function serialize(item: any, globalRegistry: Registry<Function | object>, workingRegistry: NumericRegistry<object>, outputMap: { [key: number]: object }, custom: Map<ValidPrototype, AnyCustomSerializer>, depthRemaining: number): SerializeReturn {
    const _serialize = (item: any) => serialize(item, globalRegistry, workingRegistry, outputMap, custom, depthRemaining - 1);

    if (depthRemaining === 0) {
        throw RangeError("object is too deep");
    }
    else if (typeof item === "bigint" || typeof item === "symbol") {
        throw new TypeError(`unsupported type ${typeof item}`);
    }
    else if (typeof item === "undefined") {
        return [] as undef;
    }
    else if (typeof item === "function") {
        const x = globalRegistry.getKey(item);
        if (x !== undefined) {
            return [x] as globalRef;
        }
        throw new ReferenceError(`unregistered function ${item}`);
    }
    else if (typeof item === "string" || typeof item === "boolean" || typeof item === "number") {
        return item;
    }
    else if (typeof item === "object") {
        if (item === null) {
            return null;
        }
        const x = globalRegistry.getKey(item);
        if (x !== undefined) {
            return [x] as globalRef;
        }
        const y = workingRegistry.getKey(item);
        if (y !== undefined) {
            return [y] as localRef;
        }
        let i = workingRegistry.register(item);
        const proto = Object.getPrototypeOf(item);
        let serial = (proto === Object.prototype ? [{}] : [{}, proto ? _serialize(proto) as Ref : null]) as objLit;
        outputMap[i] = serial;

        const serializer = custom.has(proto) ? custom.get(proto)! : defaultSerializer;
        serial[0] = serializer.encode(item, _serialize);

        return [i] as localRef;
    }
    else {
        throw new TypeError("this should never happen! type unrecognized");
    }
}

class Serializer {
    MAX_DEPTH: number;
    globalRegistry: Registry<Function | Object>;
    customSerializers: Map<ValidPrototype, AnyCustomSerializer>;
    /**
     * Deserialize from a string to recover an object and its ecosystem.
     * @param s a string output from Serializer.serialize.
     * @returns the unserialized object.
     */
    deserialize(s: string) {
        let data = JSON.parse(s);
        return deserialize(data[1] as SerializeReturn, this.globalRegistry, data[0] as objLit[], this.customSerializers);
    }
    /**
     * Serialize an object into a string.
     * @param obj the object to serialize.
     * @returns a string that can be deserialized to recover the object.
     */
    serialize(obj: any) {
        let out = [] as objLit[];
        return JSON.stringify([out, serialize(obj, this.globalRegistry, new NumericRegistry(), out, this.customSerializers, this.MAX_DEPTH)]);
    }
    private _register<T extends object | Function, D>(s: string, obj: T, custom?: CustomSerializer<T, D>) {
        this.globalRegistry.register(s, obj);
        if (custom) {
            this.customSerializers.set(obj, custom);
        }
    }
    /**
     * Register an object with the serializer, allowing access to it by reference.
     * @param s the name the object will use when serialized.
     * @param obj the object to register.
     * @param custom custom serialization logic for things that have the object as a prototype.
     */
    register<T extends object | Function, D>(s: string, obj: T, custom?: CustomSerializer<T, D>) {
        if (!s || !s.length) {
            throw new TypeError("Must provide a name!");
        }
        if (s[0] === "_") {
            throw new TypeError(`Provided name ${s} cannot start with an underscore!`);
        }
        if (this.globalRegistry.getKey(obj)) {
            throw new TypeError(`the object ${obj} is already registered under key ${this.globalRegistry.getKey(obj)}!`);
        }
        if (this.globalRegistry.get(s)) {
            throw new TypeError(`name ${s} is taken!`);
        }
        else {
            this._register(s, obj, custom);
        }
    }
    /**
     * Register a class constructor with the serializer, allowing access to its prototype by reference.
     * @param s the name the object will use when serialized.
     * @param cons the class to register. This is the same as registering cons.prototype.
     * @param custom custom serialization logic for instances of the class.
     */
    registerClass<T>(s: string, cons: new (...args: any) => T, custom?: CustomSerializer<T, any>) {
        if (typeof cons.prototype === "object") {
            this.register(s, cons.prototype, custom);
        }
        else {
            throw new TypeError("provided argument is not a constructor");
        }
    }
    /**
     * 
     * @param maxDepth the maximum recursion depth for serialization and deserialization.
     */
    constructor(maxDepth: number = 20) {
        this.MAX_DEPTH = maxDepth;
        this.globalRegistry = new Registry();
        this.customSerializers = new Map<object, AnyCustomSerializer>();
        this._register("_Array", Array.prototype);
        this._register("_Map", Map.prototype, {
            encode(map, _serialize) {
                return [...map].map(([key, value]) => [_serialize(key), _serialize(value)] as [any, any]);
            },
            initialize() {
                return new Map();
            },
            decode(map, data, deref) {
                for (const [key, val] of data) {
                    map.set(deref(key), deref(val));
                }
            }
        });
        this._register("_Set", Set.prototype, {
            encode(set, _serialize) {
                return [...set].map((val) => _serialize(val));
            },
            initialize() {
                return new Set();
            },
            decode(set, data, deref) {
                for (const item of data) {
                    set.add(item);
                }
            }
        });
    }
}

export { Serializer }