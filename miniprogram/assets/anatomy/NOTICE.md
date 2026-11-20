# 标准解剖图

骨骼和浅层肌肉正、背四张 PNG 均由同一个三维模型正交渲染。骨骼图排除了眼球网格，肌肉图选取模型的浅层肌肉。四张图及其改编遵循 CC BY-SA 4.0。

- Écorché by Charleeh, CC BY-SA 4.0. https://github.com/Charleeh/ecorche
- Based on BodyParts3D, © The Database Center for Life Science, CC BY 4.0, and Z-Anatomy by Gauthier Kervyn, CC BY-SA 4.0.
- https://creativecommons.org/licenses/by-sa/4.0/

用于渲染的源模型已固定到 [320805e](https://github.com/Charleeh/ecorche/tree/320805e06aee51e2e6f6b22533eb2a59d43f2d4d)。脚本生成四张图和同一坐标系的部位坐标。

```bash
blender -b -P scripts/art/render-anatomy.py -- /path/to/ecorche.glb /path/to/render
```

模型是单一成人参考样本。热点用于标记用户自述的身体区域。四张图待解剖专业人员逐张复核。

| 图 | 专业复核重点 |
|---|---|
| `bones-front.png` | 颅骨、胸骨和肋骨、骨盆轮廓，肩、腕、膝、踝标记与骨性位置是否对应。 |
| `bones-back.png` | 脊柱、肩胛骨、骶骨和尾骨，后背与尾椎的标记是否可清晰区分。 |
| `muscles-front.png` | 肩胸、腹部、大腿和小腿前方肌群的边界，以及手足与头面肌肉取舍。 |
| `muscles-back.png` | 后肩、背部、臀部和腿后方肌群的边界，以及背面软组织下的定位标记。 |

技术核对已检查四张图的尺寸、正背方向、左右标记及骨骼与肌肉共用坐标。后背和尾椎在标准图的背面标注。专业复核可逐图记录部位、问题和修改意见，并在替换素材后再次核对热点。
