# my-pi-extensions

给 [pi coding agent](https://github.com/earendil-works/pi-mono) 写的几个扩展，从 Tetris 开始，慢慢加。

## 已发布的扩展

| 扩展 | 包名 | 说明 |
|------|------|------|
| Tetris | `@allwayso/pi-tetris` | 在 pi 终端里玩俄罗斯方块 |

## 安装

```bash
pi install npm:@allwayso/pi-tetris
```

安装后在 pi 中输入 `/tetris` 启动。

也可以通过 npm 手动安装：

```bash
npm install @allwayso/pi-tetris
```

```ts
import tetris from "@allwayso/pi-tetris";
tetris(pi);
```

## 项目结构

```
my-pi-extensions/
└── packages/
    └── pi-tetris/          # 俄罗斯方块扩展
        ├── src/index.ts    # 扩展入口 + 游戏逻辑
        ├── dist/           # 编译产物
        └── README.md       # 扩展说明
```

## 开发

```bash
cd packages/pi-tetris
npm install
npm run build        # tsc 编译
```

本地测试时在 pi 项目里通过 `file:` 协议安装：

```bash
pi install file:../my-pi-extensions/packages/pi-tetris
```

## License

MIT
