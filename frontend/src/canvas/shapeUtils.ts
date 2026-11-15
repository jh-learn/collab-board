import { ShapeElement } from "../types";

// 模块级 counter：在模块加载时初始化一次
let counter = 0;
// 生成元素 ID
export function makeId(): string {
    counter += 1;
    return `s_${Date.now()}_${counter}_${Math.random().toString(36).slice(2,8)}`
}

// 判断传入元素是否“过期”
// prev 的类型是 Record<string, ShapeElement>，表示 prev 是一个对象：
// 键是字符串（实际是元素 id，如 "s_1794325678901_1_k2j9x1"）。
// 值是该 id 对应的 ShapeElement 完整数据。
export function isStale(prev: Record<string, ShapeElement>, incoming: ShapeElement): boolean{
    const exist = prev[incoming.id]
    return !!exist && (exist.version || 0) >= (incoming.version || 0)
}