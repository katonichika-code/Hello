/**
 * Rule-based auto categorizer for Japanese transactions
 * Categories: 食費, 交通費, 日用品, 娯楽, サブスク, 医療, その他, 未分類
 */

export const CATEGORIES = {
  FOOD: '食費',
  TRANSPORT: '交通費',
  DAILY: '日用品',
  ENTERTAINMENT: '娯楽',
  SUBSCRIPTION: 'サブスク',
  MEDICAL: '医療',
  OTHER: 'その他',
  UNCATEGORIZED: '未分類',
} as const;

export type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES];

interface Rule {
  category: Category;
  keywords: string[];
  patterns?: RegExp[];
}

/**
 * Normalize merchant/description text for matching
 * - Trim whitespace
 * - Convert to lowercase
 * - Collapse multiple spaces to single space
 * - Normalize various dash characters (－ー−‐―) to hyphen (-)
 * - Convert full-width space (　) to half-width space
 * - Convert full-width alphanumeric (Ａ-Ｚａ-ｚ０-９) to half-width
 */
export function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[－ー−‐―]/g, '-') // Normalize various dashes
    .replace(/　/g, ' ') // Full-width space to half-width
    // Convert full-width alphanumeric to half-width
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
    );
}

/**
 * Categorization rules (priority order - first match wins)
 */
const RULES: Rule[] = [
  // 食費 (Food)
  {
    category: CATEGORIES.FOOD,
    keywords: [
      // Convenience stores
      'セブン', 'セブンイレブン', 'ファミリーマート', 'ファミマ', 'ローソン',
      'ミニストップ', 'デイリーヤマザキ', 'newdays', 'ニューデイズ',
      'フアミリ', // Garbled FamilyMart variant
      // Supermarkets
      'イオン', 'イトーヨーカドー', 'ライフ', 'サミット', 'マルエツ',
      'オーケー', 'ok', 'コープ', '生協', 'まいばすけっと', '西友', 'seiyu',
      'ヨークマート', 'ベルク', 'ヤオコー', 'カスミ', 'いなげや',
      'オオゼキ', 'サンワ', 'ビッグエー', 'アコレ', 'マックスバリュ',
      '文化堂', // スーパー文化堂
      // Coffee & Cafes
      'スターバックス', 'starbucks', 'タリーズ', 'tullys', 'ドトール',
      'コメダ', 'サンマルク', 'ベローチェ', 'カフェ', 'cafe',
      // Fast food
      'マクドナルド', 'mcdonald', 'モスバーガー', 'ケンタッキー', 'kfc',
      'すき家', '吉野家', '松屋', 'なか卯', 'かつや', 'てんや',
      'coco壱', 'ココイチ', 'カレーハウス', 'ガスト', 'サイゼリヤ',
      'デニーズ', 'ジョナサン', 'ロイヤルホスト', 'びっくりドンキー',
      'バーミヤン', '夢庵', 'ジョイフル', 'ココス',
      // Restaurants
      '餃子の王将', '日高屋', '幸楽苑', 'リンガーハット', '丸亀製麺',
      'はなまる', 'ゆで太郎', '富士そば', '小諸そば',
      'すぱじろう', // Spaghetti restaurant chain
      '銚子丸', // Sushi chain
      // Bakeries & Sweets
      'パン', 'ベーカリー', 'bakery', 'ミスタードーナツ', 'ミスド',
      'クリスピークリーム', 'シャトレーゼ', 'コージーコーナー',
      // Delivery
      'ubereats', 'uber eats', '出前館', 'demaecan',
      // Food court / restaurants
      'フードコート', 'フ-ドコ-ト', 'food court',
      'ビストロ', 'bistro',
      '食事処', // "Eating place" prefix
      // Vending machines (drinks/snacks)
      'ジハンキ', '自販機', 'コカコーラ', 'コカ・コーラ',
      // Generic food keywords
      'レストラン', '食堂', '居酒屋', '弁当', 'ランチ', 'ディナー',
      '寿司', 'すし', 'ラーメン', 'らーめん', 'うどん', 'そば', '焼肉', '焼き肉',
      '豚骨', 'とんこつ', // Ramen types
    ],
    patterns: [
      /イオン.*(店|モール)/i,
      /セブン.*(店)/i,
    ],
  },

  // 交通費 (Transportation)
  {
    category: CATEGORIES.TRANSPORT,
    keywords: [
      // Rail
      'jr', 'ジェイアール', '東京メトロ', 'メトロ', '都営',
      '小田急', '京王', '東急', '西武', '東武', '京急', '京成',
      '相鉄', '阪急', '阪神', '南海', '近鉄', '名鉄',
      'suica', 'pasmo', 'icoca', 'pitapa',
      // Taxi & Ride
      'タクシー', 'taxi', 'uber', 'didi', 'go', 'japan taxi',
      // Air
      'ana', 'jal', '全日空', '日本航空', 'peach', 'jetstar',
      'skymark', 'airdo', 'solaseed',
      // Bus & Highway
      'バス', '高速道路', '首都高', 'etc', 'nexco',
      // Gas & Parking
      'ガソリン', 'エネオス', 'eneos', '出光', 'シェル', 'shell',
      'コスモ', 'cosmo', '駐車場', 'パーキング', 'parking', 'タイムズ',
      // Rental
      'レンタカー', 'オリックス', 'トヨタレンタ', 'ニッポンレンタ',
    ],
  },

  // サブスク (Subscriptions)
  {
    category: CATEGORIES.SUBSCRIPTION,
    keywords: [
      // Streaming
      'netflix', 'ネットフリックス', 'amazon prime', 'アマゾンプライム',
      'hulu', 'disney', 'ディズニー', 'spotify', 'apple music',
      'youtube premium', 'youtube music', 'abema', 'dazn', 'u-next',
      'dアニメ', 'd anime', 'アニメ放題',
      // Apple billing (iCloud, App Store subscriptions, etc.)
      'apple com bill', 'ＡＰＰＬＥ', 'apple.com/bill',
      // Software
      'adobe', 'microsoft 365', 'office 365', 'google one', 'icloud',
      'dropbox', 'evernote', '1password', 'notion',
      // Mobile & Internet
      'docomo', 'ドコモ', 'au', 'softbank', 'ソフトバンク',
      'rakuten mobile', '楽天モバイル', 'uq', 'ワイモバイル', 'y!mobile',
      'ahamo', 'povo', 'linemo', 'nuro', 'フレッツ', 'ocn',
      // News & Magazine
      '日経', 'nikkei', '読売', '朝日', '毎日', 'dマガジン',
      // Gym & Wellness
      'anytime fitness', 'エニタイム', 'コナミ', 'ティップネス', 'ルネサンス',
      // Other subscriptions
      'サブスク', 'subscription', '月額', '年額',
    ],
    patterns: [
      /prime\s*(video|会員)/i,
      /aws/i,
    ],
  },

  // 娯楽 (Entertainment)
  {
    category: CATEGORIES.ENTERTAINMENT,
    keywords: [
      // Cinema
      '映画', 'シネマ', 'toho', '東宝', 'イオンシネマ', 'movix',
      'ユナイテッド', '109シネマ',
      // Games
      'ゲーム', 'game', 'playstation', 'nintendo', '任天堂', 'steam',
      'ゲームセンター', 'アーケード', 'ラウンドワン',
      // Books & Music
      '本屋', '書店', '紀伊國屋', 'tsutaya', 'ツタヤ', 'ゲオ', 'geo',
      'ブックオフ', 'book', 'cd', 'dvd', 'blu-ray',
      // Theme parks
      'ディズニーランド', 'ディズニーシー', 'usj', 'ユニバーサル',
      // Karaoke
      'カラオケ', 'karaoke', 'まねきねこ', 'ビッグエコー', 'シダックス',
      // Sports & Leisure
      'ボウリング', 'ゴルフ', 'スキー', 'スノーボード', '温泉', 'スパ',
    ],
  },

  // 日用品 (Daily necessities)
  {
    category: CATEGORIES.DAILY,
    keywords: [
      // Drugstores
      'マツモトキヨシ', 'マツキヨ', 'ウエルシア', 'ツルハ', 'スギ薬局',
      'サンドラッグ', 'ココカラファイン', 'トモズ', 'tomod',
      'クリエイト', 'セイムス', 'ドラッグ', 'drug',
      // Home centers
      'ホームセンター', 'カインズ', 'コーナン', 'ビバホーム',
      'ジョイフル本田', 'diy', '島忠', 'ニトリ', 'nitori',
      'ikea', 'イケア', '無印良品', 'muji',
      // 100 yen shops
      'ダイソー', 'daiso', 'セリア', 'seria', 'キャンドゥ', 'cando',
      '100円', '100均', '百均',
      // NOTE: Department stores (マルイ, 高島屋, etc.) are intentionally NOT included
      // because purchases there are ambiguous (food, clothing, cosmetics, etc.)
      // Electronics
      'ヨドバシ', 'yodobashi', 'ビックカメラ', 'bic camera',
      'ヤマダ電機', 'yamada', 'ケーズデンキ', 'エディオン',
      // Clothing
      'ユニクロ', 'uniqlo', 'gu', 'しまむら', 'ワークマン',
      'h&m', 'zara', 'gap',
      // Cleaning & Laundry
      'クリーニング', 'コインランドリー',
    ],
  },

  // 医療 (Medical)
  {
    category: CATEGORIES.MEDICAL,
    keywords: [
      '病院', 'クリニック', '医院', '歯科', '歯医者', '眼科', '皮膚科',
      '内科', '外科', '整形外科', '耳鼻', '産婦人科', '小児科',
      '薬局', '調剤', 'pharmacy', '処方', '診療',
      '健康診断', '人間ドック',
    ],
    patterns: [
      /.*医院$/,
      /.*クリニック$/,
      /.*病院$/,
      /.*歯科$/,
    ],
  },

  // その他 (Other - specific known categories that aren't uncategorized)
  {
    category: CATEGORIES.OTHER,
    keywords: [
      // Post & Delivery
      '郵便', 'ゆうパック', 'ヤマト', '佐川', 'sagawa', '宅急便',
      // Banking fees
      '振込手数料', 'atm手数料', '利用手数料',
      // Insurance
      '保険', '損保', '生命保険',
      // Tax & Government
      '税金', '国税', '市税', '区役所', '市役所',
    ],
  },
];

/**
 * Categorize a transaction based on merchant/description
 * Returns the matched category or '未分類' if no match
 */
export function categorize(description: string): Category {
  const normalized = normalize(description);

  for (const rule of RULES) {
    // Check keywords
    for (const keyword of rule.keywords) {
      if (normalized.includes(normalize(keyword))) {
        return rule.category;
      }
    }

    // Check patterns
    if (rule.patterns) {
      for (const pattern of rule.patterns) {
        if (pattern.test(description)) {
          return rule.category;
        }
      }
    }
  }

  return CATEGORIES.UNCATEGORIZED;
}

/**
 * Get all available categories
 */
export function getAllCategories(): Category[] {
  return Object.values(CATEGORIES);
}
