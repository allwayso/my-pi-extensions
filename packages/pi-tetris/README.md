# pi-tetris

在 pi-coding-agent 中玩俄罗斯方块！

## 安装

```bash
pi install npm:@allwayso/pi-tetris
```

## 使用

安装后在 pi 中输入：

```
/tetris
```

## 操作

| 按键 | 操作 |
|------|------|
| ← → / A D | 左右移动 |
| ↑ / W | 旋转 |
| ↓ / S | 软降 |
| Space | 硬降 |
| ESC | 暂停 |
| R | 重新开始 |
| Q | 保存并退出 |

## 手动注册

如果不用 `pi install`，也可以通过 npm 安装后手动注册：

```bash
npm install @allwayso/pi-tetris
```

```ts
import tetris from "@allwayso/pi-tetris";
tetris(pi);
```

## License

MIT
