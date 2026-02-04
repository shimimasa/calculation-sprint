export const WORLDS = [
  {
    id: 'w1',
    name: 'ワールド1：スタート草原',
    description: 'たし算・ひき算を中心に慣れていこう。',
    stages: [
      {
        id: 'w1-1',
        worldId: 'w1',
        name: 'たし算ダッシュ',
        description: 'はじめてのステージ',
        settings: {
          mode: 'add',
          digit: 1,
          carry: false,
        },
        theme: {
          bgThemeId: 'grass',
          bgmId: 'bgm_world1',
        },
      },
      {
        id: 'w1-2',
        worldId: 'w1',
        name: 'ひき算リズム',
        description: 'ゆっくりひき算を覚えよう',
        settings: {
          mode: 'sub',
          digit: 1,
          carry: false,
        },
        theme: {
          bgThemeId: 'grass',
          bgmId: 'bgm_world1',
        },
      },
      {
        id: 'w1-3',
        worldId: 'w1',
        name: 'くり上がりジャンプ',
        description: 'くり上がりありのたし算',
        settings: {
          mode: 'add',
          digit: 2,
          carry: true,
        },
        theme: {
          bgThemeId: 'grass',
          bgmId: 'bgm_world1',
        },
      },
    ],
  },
  {
    id: 'w2',
    name: 'ワールド2：ミックス渓谷',
    description: 'いろいろな計算にチャレンジ。',
    stages: [
      {
        id: 'w2-1',
        worldId: 'w2',
        name: 'ミックススプリント',
        description: 'たし算とひき算をミックス',
        settings: {
          mode: 'mix',
          digit: 1,
          carry: false,
        },
        theme: {
          bgThemeId: 'canyon',
          bgmId: 'bgm_world2',
        },
      },
      {
        id: 'w2-2',
        worldId: 'w2',
        name: 'かけ算チャージ',
        description: '九九にチャレンジ',
        settings: {
          mode: 'mul',
          digit: 1,
          carry: true,
        },
        theme: {
          bgThemeId: 'canyon',
          bgmId: 'bgm_world2',
        },
      },
    ],
  },
];
