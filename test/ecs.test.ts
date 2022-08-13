import { Serializer } from "../src/index"

class Vec2 {
    [0]: number;
    [1]: number;
    get x() {
        return this[0];
    }
    get y() {
        return this[1];
    }
    constructor(x: number, y: number) {
        this[0] = x;
        this[1] = y;
    }
}

test("Class test", async () => {
    const serial = new Serializer();
    serial.registerClass("Vec2", Vec2);
    const x = new Vec2(1, 2);
    const s = serial.serialize(x);
    const y = serial.deserialize(s);
    expect(x[0]).toBe(y[0]);
    expect(x[0]).toBe(y.x);
    expect(x[1]).toBe(y[1]);
    expect(x[1]).toBe(y.y);
});

test("Circular test", async () => {
    const serial = new Serializer();
    const q = [] as any;
    q[0] = q;
    const s = serial.serialize(q);
    const qq = serial.deserialize(s);
    expect(qq[0] === qq).toBe(true);
});

test("Map test", async () => {
    const serial = new Serializer();
    const m = new Map();
    m.set(0, 0);
    const s = serial.serialize(m);
    const mm = serial.deserialize(s);
    expect(mm.get(0)).toBe(0);
});

test("Circular Map test", async () => {
    const serial = new Serializer();
    const m = new Map();
    m.set(m, [m, m, m, m, 0]);
    const s = serial.serialize(m);
    const mm = serial.deserialize(s) as typeof m;
    expect(mm.get(mm)[0]).toBe(mm);
});

test("Prototypes test", async () => {
    const serial = new Serializer();
    const x = Object.create(null);
    const y = Object.create(x);
    const z = Object.create(y);
    const s = serial.serialize([x, y, z]);
    const [xx, yy, zz] = serial.deserialize(s);
    expect(Object.getPrototypeOf(xx)).toBe(null);
    expect(Object.getPrototypeOf(yy)).toBe(xx);
    expect(Object.getPrototypeOf(zz)).toBe(yy);
});