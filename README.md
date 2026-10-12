# 材料考研专业课综合工具箱 (Materials Study Toolkit)

> 🔬 专为材料科学与工程（材料科学基础、金属学与热处理）考研学子量身打造的一体化交互式备考工作台。

[![GitHub Pages](https://img.shields.io/badge/Demo-Online%20Live-brightgreen)](https://zyx667788.github.io/materials-study-toolkit/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#)
[![Three.js](https://img.shields.io/badge/3D-Three.js-orange)](https://threejs.org/)
[![KaTeX](https://img.shields.io/badge/Math-KaTeX-blueviolet)](https://katex.org/)

---

## 🌟 在线体验

- **公网演示地址**：[https://zyx667788.github.io/materials-study-toolkit/](https://zyx667788.github.io/materials-study-toolkit/)

---

## 📖 配套权威教材与考纲对应

本项目全部 3D 几何建模算法、热力学计算模型与 1,317 道题库严格对应全国材料考研经典权威教材：
- **《材料科学基础》（第三版）**，胡赓祥、蔡珣、戎咏华 编著，上海交通大学出版社；
- **《金属学与热处理》**，崔忠圻 编著，机械工业出版社。

---

## 🚀 核心功能模块

### 1. 3D 空间交互与专业课计算工具
1. **晶面 / 晶向标定与 3D 剖切**（`#crystal`）
   - 支持立方晶系与六方晶系；
   - 动态计算并高亮 Miller 晶面指数 $(hkl)$ / 晶向指数 $[uvw]$ 空间截面几何多边形；
   - 支持识图模式自测训练与高清带水印 PNG 导出。
2. **极射赤面投影**（`#stereographic`）
   - 乌尔夫网（Wulff Net）空间三维投影；
   - 标准极图、极点指数密度动态分布与取向复位。
3. **铁碳相图（Fe-Fe3C）动态计算**（`#iron-carbon`）
   - 动态成分-温度十字光标交互拾取；
   - 全相区智能判定；
   - 实时执行**杠杆定律**，自动计算相组成物（$\alpha$、$\text{Fe}_3\text{C}$）与室温组织组成物（珠光体、莱氏体等）质量百分比。
4. **典型晶体结构库（3D）**（`#typical-structures`）
   - 包括 NaCl、CsCl、金刚石、闪锌矿、钙钛矿、密排六方、碳纳米管等典型晶胞球棍与堆垛模型。
5. **点阵与间隙（3D）**（`#interstitial`）
   - BCC / FCC / HCP 晶胞顶点、体心/面心原子空间位置；
   - 八面体间隙与四面体间隙的轮廓外框与填隙原子位置、半径比几何关系展示。
6. **位错交割与动力学（3D）**（`#dislocation`）
   - 刃型位错与螺型位错运动干涉；
   - 割阶（Jog）与扭折（Kink）形成的动力学三维可视化。
7. **三元共晶相图（3D）**（`#ternary-phase`）
   - 固态互不溶解三元共晶立体三棱柱曲面模型；
   - 三组元相区高亮、等温水平截面与变温垂直截面剖切。

### 2. 考研刷题与记忆强化系统
8. **材科基核心考点记忆卡片**（`#memory-cards`）
   - 涵盖 50+ 精选高频考点（名词解释、核心定律、公式速记）；
   - 正反翻转记忆，支持**记忆线索（Hint）**展开；
   - 配套高精度专业矢量原理图（SVG）与插图；
   - 支持艾宾浩斯掌握度评分（不会 / 记不清 / 熟练掌握）与错题本。
9. **材料考研真题题库（1,317 题）**（`#flashcards`）
   - **材料科学基础**：1,060 题（全 8 章，涵盖选择题、填空题、判断题、名词解释、综合计算题）；
   - **金属学与热处理**：257 题（全 4 章）；
   - 全面支持 KaTeX 数学与化学公式高精度排版；
   - 支持章节筛选、题型过滤、考点检索、随机抽题、交互判题与错题归纳。
10. **备考资料站与研友交流**（`#redemption`）
    - 推荐教材大纲、三轮高效复习规划、资料获取与答疑交流入口。

---

## 🛠️ 技术架构

- **前端架构**：原生 ES Modules（ESM），无需 Webpack/Vite 打包，开箱即用；
- **3D 引擎**：Three.js + OrbitControls（手势/鼠标自由平移、旋转与缩放）；
- **公式排版**：KaTeX 客户端数学渲染；
- **存储方案**：客户端 `localStorage` 离线持久化存储学习进度、做题记录与收藏夹；
- **无服务架构**：纯静态托管，零后端维护成本，支持 Cloudflare Pages、Vercel、GitHub Pages、Nginx。

---

## 💻 本地运行

无需安装复杂的构建工具，只需任意静态文件服务即可：

```bash
# 使用内置 Node.js 启动本地服务：
node server.js

# 打开浏览器访问：
http://127.0.0.1:8089/
```

---

## 🎨 客户定制指南

若需替换为自己的专属品牌：
1. **替换站点 Logo**：将您的 Logo 放置为 `assets/app-logo.svg` 或修改 `index.html` 中的引用路径。
2. **替换微信/交流群二维码**：将您的真实二维码图片替换 `assets/app-qrcode.svg`。
3. **修改品牌文案**：全局搜索 `index.html` 中的标题与页脚文案即可自定义名称。
4. **扩展题库**：直接编辑 `data/caikeji_questions.json` 或 `data/metallurgy_questions.json`，遵循统一 JSON 结构即可无缝新增题目。
