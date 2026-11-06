import type { Slot } from '@/constants'

/** 没有照片时占位图用的衣物剪影 */
export type Shape =
  | 'tshirt'
  | 'tank'
  | 'hoodie'
  | 'sweater'
  | 'shirt'
  | 'pants'
  | 'shorts'
  | 'skirt'
  | 'dress'
  | 'jumpsuit'
  | 'jacket'
  | 'coat'
  | 'puffer'
  | 'sneaker'
  | 'boot'
  | 'heel'
  | 'sandal'
  | 'bag'
  | 'hat'
  | 'scarf'
  | 'glasses'
  | 'belt'

/**
 * 每个部位下按顺序匹配的关键词，第一条命中的生效；都没命中时用 fallback。
 * 只在同一部位内匹配，所以「吊带裙」（连衣裙）不会被认成上装的吊带。
 * 顺序有讲究：「长袖T恤」先命中长袖（sweater），「T-shirt」要排在 shirt 前面。
 */
const RULES: Record<Slot, { fallback: Shape; rules: [RegExp, Shape][] }> = {
  top: {
    fallback: 'tshirt',
    rules: [
      [/背心|吊带|无袖|tank|cami/i, 'tank'],
      [/卫衣|帽衫|连帽|hoodie/i, 'hoodie'],
      [/毛衣|针织|开衫|长袖|打底|sweater|knit|cardigan/i, 'sweater'],
      [/t恤|tee|t-?shirt|短袖/i, 'tshirt'],
      [/衬衫|衬衣|polo|shirt|blouse/i, 'shirt'],
    ],
  },
  bottom: {
    fallback: 'pants',
    rules: [
      [/短裤|shorts/i, 'shorts'],
      [/裙|skirt/i, 'skirt'],
    ],
  },
  onepiece: {
    fallback: 'dress',
    rules: [[/背带|连体|jumpsuit|overall|romper/i, 'jumpsuit']],
  },
  outer: {
    fallback: 'jacket',
    rules: [
      [/羽绒|棉服|棉衣|面包服|puffer|down/i, 'puffer'],
      [/大衣|风衣|长款|coat|trench/i, 'coat'],
    ],
  },
  shoes: {
    fallback: 'sneaker',
    rules: [
      [/靴|boot/i, 'boot'],
      [/高跟|单鞋|heel|pump/i, 'heel'],
      [/凉鞋|拖鞋|sandal|slipper|slide/i, 'sandal'],
    ],
  },
  accessory: {
    fallback: 'bag',
    rules: [
      [/帽|cap|hat|beanie/i, 'hat'],
      [/围巾|丝巾|披肩|scarf/i, 'scarf'],
      [/眼镜|墨镜|glasses/i, 'glasses'],
      [/腰带|皮带|belt/i, 'belt'],
    ],
  },
}

/** 先看类型，再看名称（例如名称「摇粒绒卫衣」），都匹配不上就用部位的默认剪影 */
export function resolveShape(slot: Slot, kind?: string | null, name?: string | null): Shape {
  const { fallback, rules } = RULES[slot]
  for (const text of [kind, name]) {
    if (!text) continue
    const hit = rules.find(([re]) => re.test(text))
    if (hit) return hit[1]
  }
  return fallback
}

/** 原型页用：列出每个部位的规则，方便核对 */
export const SHAPE_RULES = RULES
