"use client";

import type { PetStatus } from "@/lib/petBus";

/** 宠物视觉态：业务状态 + blink（idle 随机眨眼）+ walk（漫游走动帧）。 */
export type PetFace = PetStatus | "blink" | "walk";

interface PetDogSpriteProps {
  face: PetFace;
  /** 像素画布放大倍数（每个像素块的边长）。 */
  scale?: number;
  /** 走动时的帧序号（0/1 交替，控制腿部摆动）。 */
  walkFrame?: number;
}

/** 原创像素小狗调色板（暖棕系，简洁可爱，非任何受版权保护形象）。 */
const PALETTE: Record<string, string> = {
  ".": "transparent",
  B: "#7a4a22", // 深棕（轮廓/耳朵）
  b: "#c98a4b", // 主体棕
  l: "#f0cfa0", // 浅棕（肚子/嘴）
  W: "#ffffff", // 白（眼高光）
  K: "#2b1a0d", // 黑（眼/鼻）
  P: "#f6849b", // 粉（舌头）
};

/** 头顶 + 耳朵（行 0-3）。 */
const HEAD: string[] = [
  "..BB......BB....",
  ".BbbB....BbbB...",
  ".BbbbBBBBbbbbB..",
  ".BbbbbbbbbbbbB..",
];

/** 身体 + 肚子（行 8-11）。 */
const BODY: string[] = [
  ".BbbbbbbbbbbbB..",
  ".BbllllllllbbB.",
  ".BbllllllllbbB.",
  ".BbbbbbbbbbbbB..",
];

/** 站立腿（idle/happy/sad/busy/blink 共用，行 12-13）。 */
const LEGS_STAND: string[] = ["..Bb.b..b.bB...", "..BB.B..B.BB..."];

/** 走动两帧腿（walk）。 */
const LEGS_WALK: string[][] = [
  ["...Bb..b.bB....", "...BB...B.BB..."],
  ["..Bb.b..bB.....", "..BB.B..BB....."],
];

/**
 * 脸部 4 行（眼 + 鼻 + 嘴），随表情变化。
 * 采用对称居中五官，自然可爱；朝向不靠扭脸表达（对称脸翻转无违和）。
 */
function buildFaceRows(face: PetFace): string[] {
  switch (face) {
    case "blink":
      return [
        ".BbbbbbbbbbbbB..",
        ".BbKKbbbbKKbbB.",
        ".BbbbbKKbbbbbB.",
        ".BbbllPllbbbbB.",
      ];
    case "happy":
      return [
        ".BbbbbbbbbbbbB..",
        ".BWKbbbbbWKbbB.",
        ".BbbbbKKbbbbbB.",
        ".BblPPPPllbbbB.",
      ];
    case "sad":
      return [
        ".BbbbbbbbbbbbB..",
        ".BbKbbbbbbKbbB.",
        ".BbbbbKKbbbbbB.",
        ".BbbbllllbbbbB.",
      ];
    case "busy":
      return [
        ".BbbbbbbbbbbbB..",
        ".BbKKbbbbKKbbB.",
        ".BbbbbKKbbbbbB.",
        ".BbblPllbbbbbB.",
      ];
    default:
      // idle / walk：圆眼带高光 + 微笑吐小舌
      return [
        ".BbbbbbbbbbbbB..",
        ".BbKWbbbbKWbbB.",
        ".BbbbbKKbbbbbB.",
        ".BbblPllbbbbbB.",
      ];
  }
}

/** 统一每行长度为 16（不足补 '.'，超出截断），保证网格矩形。 */
function normalize16(line: string): string {
  return line.length >= 16 ? line.slice(0, 16) : line.padEnd(16, ".");
}

/** 组装完整 16x16 网格。 */
function buildGrid(face: PetFace, walkFrame: number): string[] {
  const legs = face === "walk" ? LEGS_WALK[walkFrame % 2] : LEGS_STAND;
  return [...HEAD, ...buildFaceRows(face), ...BODY, ...legs].map(normalize16);
}

/**
 * 原创像素艺术风格小狗（PRD v4.7）。
 * 16x16 像素网格（字符画 → SVG rect），shapeRendering=crispEdges + imageRendering=pixelated
 * 保证放大锐利不模糊。通过 face / walkFrame 切换表情与腿部动作。
 */
export function PetDogSprite({
  face,
  scale = 5,
  walkFrame = 0,
}: PetDogSpriteProps) {
  const grid = buildGrid(face, walkFrame);
  const cols = 16;
  const rows = grid.length;

  return (
    <svg
      width={cols * scale}
      height={rows * scale}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated", display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {grid.map((line, y) =>
        line.split("").map((char, x) => {
          const color = PALETTE[char] ?? "transparent";
          if (color === "transparent") return null;
          // 每个像素块略微外扩 0.04（坐标回退 0.02），让相邻块互相重叠，
          // 吃掉浏览器在亚像素栅格化时露出的背景白缝。
          return (
            <rect
              key={`${x}-${y}`}
              x={x - 0.02}
              y={y - 0.02}
              width={1.04}
              height={1.04}
              fill={color}
            />
          );
        })
      )}
    </svg>
  );
}
