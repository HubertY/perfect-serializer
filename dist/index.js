class Registry {
    constructor() {
        this.forward = {};
        this.backward = new Map();
    }
    register(key, value) {
        this.forward[key] = value;
        this.backward.set(value, key);
        return key;
    }
    get(key) {
        return this.forward[key];
    }
    getKey(obj) {
        return this.backward.get(obj);
    }
}
class NumericRegistry {
    constructor(data = []) {
        this.forward = data;
        this.backward = new Map();
        for (let i = 0; i < this.forward.length; i++) {
            this.backward.set(this.forward[i], i);
        }
    }
    register(value) {
        this.backward.set(value, this.forward.length);
        this.forward.push(value);
        return this.forward.length - 1;
    }
    get(key) {
        return this.forward[key];
    }
    getKey(obj) {
        return this.backward.get(obj);
    }
}
const defaultSerializer = {
    encode(item, _serialize) {
        let ret = {};
        if (Object.getOwnPropertySymbols(item).length) {
            throw new TypeError(`unregistered object ${item} has symbol properties!`);
        }
        for (let prop of Object.getOwnPropertyNames(item)) {
            const desc = Object.getOwnPropertyDescriptor(item, prop);
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
        for (let prop of Object.keys(data)) {
            const desc = data[prop];
            const wec = desc[1] ? desc[1] : WriteableEnumerableConfigurable.TTT;
            let descriptor = decodeDescriptorParams(wec);
            const content = desc[0];
            descriptor.value = lookup(content);
            Object.defineProperty(obj, prop, descriptor);
        }
    }
};
function deserialize(item, globalRegistry, objectRegistry, custom = new Map()) {
    const built = objectRegistry.map(() => undefined);
    const serials = [];
    //const callbacks = objectRegistry.map(() => new Map()) as Map<number, Function>[];
    //const waits = objectRegistry.map(() => new Set()) as Set<Function>[];
    const deGlobalRef = (key) => {
        let lookup = globalRegistry.get(key);
        if (lookup !== undefined) {
            return lookup;
        }
        else {
            throw new ReferenceError(`global ref ${key} not found!`);
        }
    };
    const deLocalRef = (key) => {
        if (built[key]) {
            return built[key];
        }
        else {
            throw RangeError("object isn't built yet!");
        }
    };
    function protoCycle(i) {
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
            serials[i] = custom.has(proto) ? custom.get(proto) : defaultSerializer;
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
    function lookup(item) {
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
        const data = objectRegistry[i][0];
        const serial = serials[i];
        serial.decode(built[i], data, lookup);
    }
    return lookup(item);
}
var WriteableEnumerableConfigurable;
(function (WriteableEnumerableConfigurable) {
    WriteableEnumerableConfigurable[WriteableEnumerableConfigurable["TTT"] = 0] = "TTT";
    WriteableEnumerableConfigurable[WriteableEnumerableConfigurable["TTF"] = 1] = "TTF";
    WriteableEnumerableConfigurable[WriteableEnumerableConfigurable["TFT"] = 2] = "TFT";
    WriteableEnumerableConfigurable[WriteableEnumerableConfigurable["TFF"] = 3] = "TFF";
    WriteableEnumerableConfigurable[WriteableEnumerableConfigurable["FTT"] = 4] = "FTT";
    WriteableEnumerableConfigurable[WriteableEnumerableConfigurable["FTF"] = 5] = "FTF";
    WriteableEnumerableConfigurable[WriteableEnumerableConfigurable["FFT"] = 6] = "FFT";
    WriteableEnumerableConfigurable[WriteableEnumerableConfigurable["FFF"] = 7] = "FFF";
})(WriteableEnumerableConfigurable || (WriteableEnumerableConfigurable = {}));
function decodeDescriptorParams(i) {
    let ret = { writeable: true, enumerable: true, configurable: true };
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
function compressPropertyDescriptor(d) {
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
function serialize(item, globalRegistry, workingRegistry, outputMap, custom, depthRemaining) {
    const _serialize = (item) => serialize(item, globalRegistry, workingRegistry, outputMap, custom, depthRemaining - 1);
    if (depthRemaining === 0) {
        throw RangeError("object is too deep");
    }
    else if (typeof item === "bigint" || typeof item === "symbol") {
        throw new TypeError(`unsupported type ${typeof item}`);
    }
    else if (typeof item === "undefined") {
        return [];
    }
    else if (typeof item === "function") {
        const x = globalRegistry.getKey(item);
        if (x !== undefined) {
            return [x];
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
            return [x];
        }
        const y = workingRegistry.getKey(item);
        if (y !== undefined) {
            return [y];
        }
        let i = workingRegistry.register(item);
        const proto = Object.getPrototypeOf(item);
        let serial = (proto === Object.prototype ? [{}] : [{}, proto ? _serialize(proto) : null]);
        outputMap[i] = serial;
        const serializer = custom.has(proto) ? custom.get(proto) : defaultSerializer;
        serial[0] = serializer.encode(item, _serialize);
        return [i];
    }
    else {
        throw new TypeError("this should never happen! type unrecognized");
    }
}
class Serializer {
    /**
     *
     * @param maxDepth the maximum recursion depth for serialization and deserialization.
     */
    constructor(maxDepth = 20) {
        this.MAX_DEPTH = maxDepth;
        this.globalRegistry = new Registry();
        this.customSerializers = new Map();
        this._register("_Array", Array.prototype);
        this._register("_Map", Map.prototype, {
            encode(map, _serialize) {
                return [...map].map(([key, value]) => [_serialize(key), _serialize(value)]);
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
    /**
     * Deserialize from a string to recover an object and its ecosystem.
     * @param s a string output from Serializer.serialize.
     * @returns the unserialized object.
     */
    deserialize(s) {
        let data = JSON.parse(s);
        return deserialize(data[1], this.globalRegistry, data[0], this.customSerializers);
    }
    /**
     * Serialize an object into a string.
     * @param obj the object to serialize.
     * @returns a string that can be deserialized to recover the object.
     */
    serialize(obj) {
        let out = [];
        return JSON.stringify([out, serialize(obj, this.globalRegistry, new NumericRegistry(), out, this.customSerializers, this.MAX_DEPTH)]);
    }
    _register(s, obj, custom) {
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
    register(s, obj, custom) {
        if (!s.length) {
            throw new TypeError("Must provide a name!");
        }
        if (this.globalRegistry.getKey(obj)) {
            console.warn(`object ${obj} is already registered under key ${this.globalRegistry.getKey(obj)}`);
            return;
        }
        if (s.indexOf(".") === -1) {
            s = `.${s}`;
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
    registerClass(s, cons, custom) {
        if (typeof cons.prototype === "object") {
            this.register(s, cons.prototype, custom);
        }
        else {
            throw new TypeError("provided argument is not a constructor");
        }
    }
    /**
     * Register a set of objects with the serializer under a shared namespace.
     * @param namespace prefix for names registered with the module.
     * @param module
     */
    registerModule(namespace, module) {
        for (const key of Object.keys(module)) {
            this.register(`${namespace}.${key}`, module[key].item, module[key].custom);
        }
    }
}
export { Serializer };
