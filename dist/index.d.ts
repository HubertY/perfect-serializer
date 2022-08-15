declare class Registry<T = object> {
    forward: {
        [s: string]: T;
    };
    backward: Map<T, string>;
    register(key: string, value: T): string;
    get(key: string): T;
    getKey(obj: T): string | undefined;
    constructor();
}
export declare type CustomSerializer<T, S> = {
    encode: (arg: T, serial: Function) => S;
    initialize: (proto: ValidPrototype) => T;
    decode: (item: T, arg: S, deref: (s: SerializeReturn) => any, decode?: DeferredLookup) => void;
};
declare type AnyCustomSerializer = CustomSerializer<any, any>;
declare type DeferredLookup = (value: any, cb: (item: any) => void) => void;
declare type globalRef = [string];
declare type localRef = [number];
declare type undef = [];
declare type SerializeReturn = undef | null | globalRef | localRef | string | boolean | number;
declare type ValidPrototype = object | Function | null;
declare type RegisterArgs<T, D> = {
    item: T;
    custom?: CustomSerializer<T, D>;
};
export declare type SerializerModuleArgs = Record<string, RegisterArgs<any, any>>;
declare class Serializer {
    MAX_DEPTH: number;
    globalRegistry: Registry<Function | Object>;
    customSerializers: Map<ValidPrototype, AnyCustomSerializer>;
    /**
     * Deserialize from a string to recover an object and its ecosystem.
     * @param s a string output from Serializer.serialize.
     * @returns the unserialized object.
     */
    deserialize(s: string): any;
    /**
     * Serialize an object into a string.
     * @param obj the object to serialize.
     * @returns a string that can be deserialized to recover the object.
     */
    serialize(obj: any): string;
    private _register;
    /**
     * Register an object with the serializer, allowing access to it by reference.
     * @param s the name the object will use when serialized.
     * @param obj the object to register.
     * @param custom custom serialization logic for things that have the object as a prototype.
     */
    register<T extends object | Function, D>(s: string, obj: T, custom?: CustomSerializer<T, D>): void;
    /**
     * Register a class constructor with the serializer, allowing access to its prototype by reference.
     * @param s the name the object will use when serialized.
     * @param cons the class to register. This is the same as registering cons.prototype.
     * @param custom custom serialization logic for instances of the class.
     */
    registerClass<T>(s: string, cons: new (...args: any) => T, custom?: CustomSerializer<T, any>): void;
    /**
     * Register a set of objects with the serializer under a shared namespace.
     * @param namespace prefix for names registered with the module.
     * @param module
     */
    registerModule(namespace: string, module: SerializerModuleArgs): void;
    /**
     *
     * @param maxDepth the maximum recursion depth for serialization and deserialization.
     */
    constructor(maxDepth?: number);
}
export { Serializer };
