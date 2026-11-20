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
