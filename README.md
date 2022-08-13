# perfect-serializer
a javascript serializer that never* makes mistakes

unsupported:
- bigint
- symbol
- circular prototypes
- secretly calling native code on objects

supported:
- circular references
- objects with prototypes
- writeable/configurable/enumerable

must register:
- functions
- objects with own symbols
- objects with own getter/setter

todo:
- never make mistakes
- deferred mid-custom serialization deep object access 
- walk prototype to check safety
- seal/preventExtension etc.

js objects have:
ownProperties (getOwnPropertyNames, getOwnPropertyDescriptors)
a prototype
native fields (can only be set by the prototype constructor)