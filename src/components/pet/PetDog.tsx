"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePetStatus, type PetStatus } from "@/lib/petBus";
import { getPetLine, getPetMischiefLine, getPetFleeLine } from "@/config/petLines";
import { PET_CONFIG } from "@/config/petConfig";
import { loadPetPrefs, savePetPrefs, type PetPrefs } from "@/services/petPrefs";
import { PetDogSprite, type PetFace } from "./PetDogSprite";

/** 状态/台词自动复位 idle 的延时（毫秒）。 */
const AUTO_RESET_MS = 5000;
/** 点击气泡台词展示时长（毫秒）。 */
const BUBBLE_MS = 4000;

/** 小狗当前定位（视口绝对像素）。 */
interface Position {
  x: number;
  y: number;
}

/** 漫游运行态：目标点、朝向、是否处于停顿、本段是否为"溜进中间"的调皮目标、是否处于逃跑。 */
interface RoamState {
  target: Position;
  facingRight: boolean;
  pausedUntil: number;
  /** 本次目标点是否落在中间工作区（调皮溜进去）。 */
  mischief: boolean;
  /** 是否处于"被发现快速逃回空白"状态（用更快速度）。 */
  fleeing: boolean;
}

const PET_PX = PET_CONFIG.spriteCols * PET_CONFIG.scale;

/** 左侧空白区结束的 X（视口比例 sideZoneRatio）。 */
function leftZoneEdge(): number {
  return window.innerWidth * PET_CONFIG.sideZoneRatio;
}

/** 右侧空白区起始的 X。 */
function rightZoneStart(): number {
  return window.innerWidth * (1 - PET_CONFIG.sideZoneRatio);
}

/** 判断某个 X（小狗左上角）是否处于中间工作区（60%）。 */
function isInCenter(x: number): boolean {
  const dogCenterX = x + PET_PX / 2;
  return dogCenterX > leftZoneEdge() && dogCenterX < rightZoneStart();
}

/**
 * 电子宠物·像素小狗"旺财"（PRD v4.7）。
 *
 * 双模式：
 *  - 漫游模式（两侧留白足够宽）：在左右留白竖带内随机选点、慢速平滑游走（walk 帧 + 朝向翻转），
 *    到达后停顿/眨眼/发呆再选下一点；绝不进入中间工作区。
 *  - 角落模式（留白过窄/小屏）：退回右下角 idle 浮动 + 随机眨眼。
 *
 * 忙碌时（跑批/接入/评价进行中）停止漫游、原地待命；完成后恢复漫游。
 * 支持点击说话、拖动、隐藏/唤出、偏好持久化。纯前端彩蛋，只读状态、不影响业务，z-30 不遮挡关键弹框。
 */
export function PetDog() {
  const [prefs, setPrefs] = useState<PetPrefs | null>(null);
  const [status, setStatus] = useState<PetStatus>("idle");
  const [canRoam, setCanRoam] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [facingRight, setFacingRight] = useState(true);
  const [isWalking, setIsWalking] = useState(false);
  const [walkFrame, setWalkFrame] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);

  const statusRef = useRef<PetStatus>("idle");
  const canRoamRef = useRef(false);
  const positionRef = useRef<Position>({ x: 0, y: 0 });
  const roamRef = useRef<RoamState | null>(null);
  const visibleRef = useRef(true);
  const isWalkingRef = useRef(false);
  const draggingRef = useRef<{
    active: boolean;
    moved: boolean;
    offsetX: number;
    offsetY: number;
  }>({ active: false, moved: false, offsetX: 0, offsetY: 0 });
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walkFrameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 拖动松手后延时恢复漫游的定时器。
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 本次会话用户是否手动拖动过：拖过则尊重固定位置、暂不漫游（不依赖持久化的旧 position）。
  const userPinnedRef = useRef(false);
  // 是否已为"本段溜进中间"说过调皮台词（避免每帧重复触发）。
  const mischiefSpokenRef = useRef(false);
  // 持有最新的回调，供"只挂载一次"的 rAF 循环调用，避免闭包陈旧。
  const pickNextTargetRef = useRef<() => void>(() => {});
  const showBubbleRef = useRef<(text: string) => void>(() => {});
  // 设置项 ref：是否允许漫游、到达后停顿时长（供 rAF 循环读取）。
  const roamEnabledRef = useRef(true);
  const pauseDurationRef = useRef<number | undefined>(undefined);
  // 设置面板是否展开。
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 同步 ref（供 rAF 循环读取最新值，避免闭包陈旧）。
  statusRef.current = status;
  canRoamRef.current = canRoam;
  // 注意：position 不在此处反向同步，避免覆盖 rAF 写入的浮点累积值（位置以 positionRef 为准）。
  visibleRef.current = !!prefs?.visible;
  roamEnabledRef.current = prefs?.roamEnabled !== false;
  pauseDurationRef.current = prefs?.pauseDurationMs;

  const showBubble = useCallback((text: string) => {
    if (!text) return;
    setBubble(text);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);
  showBubbleRef.current = showBubble;

  // 计算右下角待机坐标。
  const cornerPosition = useCallback((): Position => {
    return {
      x: window.innerWidth - PET_PX - PET_CONFIG.cornerMargin,
      y: window.innerHeight - PET_PX - PET_CONFIG.cornerMargin,
    };
  }, []);

  // 随机取一个 Y 坐标（竖向活动区间内）。
  const randomY = useCallback((): number => {
    const minY = PET_CONFIG.verticalPadding;
    const maxY = Math.max(minY, window.innerHeight - PET_PX - PET_CONFIG.verticalPadding);
    return Math.round(minY + Math.random() * Math.max(0, maxY - minY));
  }, []);

  // 在指定区域内随机取目标点。zone: "left"/"right"=两侧空白 20%，"center"=中间工作区 60%。
  const randomTargetInZone = useCallback(
    (zone: "left" | "right" | "center"): Position => {
      const w = window.innerWidth;
      let minX: number;
      let maxX: number;
      if (zone === "left") {
        minX = 4;
        maxX = Math.max(minX, leftZoneEdge() - PET_PX - 4);
      } else if (zone === "right") {
        minX = rightZoneStart() + 4;
        maxX = Math.max(minX, w - PET_PX - 4);
      } else {
        minX = leftZoneEdge() + 8;
        maxX = Math.max(minX, rightZoneStart() - PET_PX - 8);
      }
      const x = Math.round(minX + Math.random() * Math.max(0, maxX - minX));
      return { x, y: randomY() };
    },
    [randomY]
  );

  // 选下一个漫游目标：95% 落在两侧空白区（挑离当前较远侧以保证可见走动），
  // 5% 调皮地溜进中间工作区。
  const pickNextTarget = useCallback(() => {
    const cur = positionRef.current;
    const mischief = Math.random() < PET_CONFIG.centerRoamChance;
    let target: Position;
    if (mischief) {
      target = randomTargetInZone("center");
    } else {
      // 绝大多数时间留在"当前所在的同一侧空白区"内小范围溜达，避免频繁左右横穿而途经中间。
      // 只有较小概率（switchSideChance）才切换到对侧。
      const curCenterX = cur.x + PET_PX / 2;
      const onLeftSide = curCenterX <= window.innerWidth / 2;
      const currentZone: "left" | "right" = onLeftSide ? "left" : "right";
      const switchSide = Math.random() < PET_CONFIG.switchSideChance;
      const zone: "left" | "right" = switchSide
        ? currentZone === "left"
          ? "right"
          : "left"
        : currentZone;
      target = randomTargetInZone(zone);
    }
    const facing = target.x >= cur.x;
    roamRef.current = {
      target,
      facingRight: facing,
      pausedUntil: 0,
      mischief,
      fleeing: false,
    };
    setFacingRight(facing);
  }, [randomTargetInZone]);
  pickNextTargetRef.current = pickNextTarget;

  // 立即逃回最近的空白区（被发现时调用），用更快的逃跑速度。
  const fleeToNearestZone = useCallback(() => {
    const cur = positionRef.current;
    const curCenterX = cur.x + PET_PX / 2;
    // 离左空白近还是右空白近。
    const zone: "left" | "right" =
      curCenterX - leftZoneEdge() < rightZoneStart() - curCenterX ? "left" : "right";
    const target = randomTargetInZone(zone);
    const facing = target.x >= cur.x;
    roamRef.current = {
      target,
      facingRight: facing,
      pausedUntil: 0,
      mischief: false,
      fleeing: true,
    };
    setFacingRight(facing);
  }, [randomTargetInZone]);

  // 初次挂载：读偏好 + 初始化位置。
  // 注意：刷新后总是从角落起步，不沿用旧的持久化坐标——否则会被旧位置"钉住"看起来不漫游。
  // 用户本会话拖动后才会进入固定位置（userPinnedRef），那是当前会话的实时行为。
  useEffect(() => {
    const loaded = loadPetPrefs();
    setPrefs(loaded);
    const initial = cornerPosition();
    setPosition(initial);
    positionRef.current = initial;
  }, [cornerPosition]);

  // 根据留白宽度判断是否可漫游（窗口缩放实时响应）。
  // 留白 = (视口宽 - 内容区宽)/2；只要单侧留白 ≥ 阈值即可漫游（阈值已含小狗活动余量）。
  useEffect(() => {
    const evaluate = () => {
      const gap = (window.innerWidth - PET_CONFIG.contentMaxWidth) / 2;
      const roamable = gap >= PET_CONFIG.roamThreshold;
      setCanRoam(roamable);
      if (!roamable) {
        // 留白不足：退回角落待机。
        roamRef.current = null;
        setIsWalking(false);
      }
    };
    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, []);

  // 订阅业务状态：切表情 + 说台词；忙碌时停漫游。
  useEffect(() => {
    const unsubscribe = subscribePetStatus((event) => {
      setStatus(event.status);
      if (event.status !== "idle") showBubble(getPetLine(event.status, event.scene));
      if (event.status === "busy") {
        // 忙碌：原地待命，停止漫游。
        roamRef.current = null;
        setIsWalking(false);
      }
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (event.status === "happy" || event.status === "sad") {
        resetTimerRef.current = setTimeout(() => setStatus("idle"), AUTO_RESET_MS);
      }
    });
    return unsubscribe;
  }, [showBubble]);

  // 漫游主循环：只在挂载时启动一次的自洽 rAF，所有动态条件走 ref，避免依赖变化频繁重建
  // 导致 dt 归零、原地踏步（之前"腿动却卡住不挪窝"的根因）。
  useEffect(() => {
    let raf = 0;
    let lastTs = 0;

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);

      // 是否允许漫游：设置开启 + 可漫游 + idle + 可见 + 本会话未手动拖动 + 未在拖拽中。
      const active =
        roamEnabledRef.current &&
        canRoamRef.current &&
        statusRef.current === "idle" &&
        visibleRef.current &&
        !userPinnedRef.current &&
        !draggingRef.current.active;

      if (!active) {
        lastTs = 0;
        if (isWalkingRef.current) {
          isWalkingRef.current = false;
          setIsWalking(false);
        }
        return;
      }

      if (!roamRef.current) pickNextTargetRef.current();

      if (lastTs === 0) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05); // 钳制 dt，防止切后台回来跳一大步
      lastTs = ts;

      const roam = roamRef.current;
      if (!roam) return;

      if (roam.pausedUntil > ts) {
        if (isWalkingRef.current) {
          isWalkingRef.current = false;
          setIsWalking(false);
        }
        return;
      }

      const cur = positionRef.current;
      const dx = roam.target.x - cur.x;
      const dy = roam.target.y - cur.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 2) {
        // 到达 → 停顿，再选下一点。设置面板指定了固定停顿时长则用它，否则随机。
        const pause =
          pauseDurationRef.current !== undefined
            ? pauseDurationRef.current
            : PET_CONFIG.pauseMinMs +
              Math.random() * (PET_CONFIG.pauseMaxMs - PET_CONFIG.pauseMinMs);
        roam.pausedUntil = ts + pause;
        if (isWalkingRef.current) {
          isWalkingRef.current = false;
          setIsWalking(false);
        }
        window.setTimeout(() => {
          if (statusRef.current === "idle" && canRoamRef.current) {
            pickNextTargetRef.current();
          }
        }, pause);
        return;
      }

      const speed = roam.fleeing ? PET_CONFIG.fleeSpeed : PET_CONFIG.walkSpeed;
      const step = Math.min(dist, speed * dt);
      const nx = cur.x + (dx / dist) * step;
      const ny = cur.y + (dy / dist) * step;
      positionRef.current = { x: nx, y: ny };
      setPosition({ x: Math.round(nx), y: Math.round(ny) });
      if (!isWalkingRef.current) {
        isWalkingRef.current = true;
        setIsWalking(true);
      }

      // 调皮：踏入中间工作区时说一句（每段只说一次）。
      if (isInCenter(nx)) {
        if (!mischiefSpokenRef.current) {
          mischiefSpokenRef.current = true;
          showBubbleRef.current(getPetMischiefLine());
        }
      } else {
        mischiefSpokenRef.current = false;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 走动帧切换（仅 isWalking 时）。
  useEffect(() => {
    if (!isWalking) {
      if (walkFrameTimerRef.current) clearInterval(walkFrameTimerRef.current);
      walkFrameTimerRef.current = null;
      return;
    }
    walkFrameTimerRef.current = setInterval(() => {
      setWalkFrame((prev) => (prev + 1) % 2);
    }, PET_CONFIG.walkFrameMs);
    return () => {
      if (walkFrameTimerRef.current) clearInterval(walkFrameTimerRef.current);
    };
  }, [isWalking]);

  // 待机随机眨眼（idle 且非走动时）。
  useEffect(() => {
    if (status !== "idle" || isWalking) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 2500 + Math.random() * 4000;
      timer = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 180);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [status, isWalking]);

  // 卸载清理（漫游 rAF 由其自身 effect 的 cleanup 负责）。
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      if (walkFrameTimerRef.current) clearInterval(walkFrameTimerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const persist = useCallback((next: PetPrefs) => {
    setPrefs(next);
    savePetPrefs(next);
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      draggingRef.current = {
        active: true,
        moved: false,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      // 按下即停漫游（若发生拖动，pointerUp 会标记 userPinned）。
      roamRef.current = null;
      setIsWalking(false);
    },
    []
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = draggingRef.current;
      if (!drag.active) return;
      drag.moved = true;
      const maxX = window.innerWidth - PET_PX - 4;
      const maxY = window.innerHeight - PET_PX - 4;
      const x = Math.round(Math.max(4, Math.min(event.clientX - drag.offsetX, maxX)));
      const y = Math.round(Math.max(4, Math.min(event.clientY - drag.offsetY, maxY)));
      const next = { x, y };
      positionRef.current = next;
      setPosition(next);
    },
    []
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = draggingRef.current;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (drag.active && drag.moved) {
        // 拖动结束 → 临时停在落点，过几秒自动恢复漫游（不再永久钉死）。
        userPinnedRef.current = true;
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = setTimeout(() => {
          userPinnedRef.current = false;
          roamRef.current = null; // 清空旧目标，让循环从当前落点重新选点起步
        }, PET_CONFIG.resumeAfterDragMs);
      } else if (drag.active && !drag.moved) {
        // 纯点击：
        // - 若此刻它正赖在中间工作区 → 被抓包，快速逃回空白处 + 说逃跑话。
        // - 否则 → 正常停下说一句台词。
        if (isInCenter(positionRef.current.x) && canRoamRef.current && statusRef.current === "idle") {
          mischiefSpokenRef.current = true; // 逃跑途中不再重复说调皮话
          fleeToNearestZone();
          showBubble(getPetFleeLine());
        } else {
          showBubble(getPetLine(statusRef.current === "idle" ? "idle" : statusRef.current));
        }
      }
      draggingRef.current = { active: false, moved: false, offsetX: 0, offsetY: 0 };
    },
    [showBubble, fleeToNearestZone]
  );

  const handleHide = useCallback(() => {
    if (!prefs) return;
    persist({ ...prefs, visible: false });
  }, [prefs, persist]);

  // 设置：切换"是否允许动"。关闭时立即停下回角落待命。
  const handleToggleRoam = useCallback(
    (enabled: boolean) => {
      if (!prefs) return;
      if (!enabled) {
        roamRef.current = null;
        setIsWalking(false);
      } else {
        // 重新开启 → 清掉手动锁定与旧目标，让它马上溜达起来。
        userPinnedRef.current = false;
        roamRef.current = null;
      }
      persist({ ...prefs, roamEnabled: enabled });
    },
    [prefs, persist]
  );

  // 设置："不能动多久" = 到达目标后的停顿时长档位。undefined 表示随机（自然）。
  const handleSetPause = useCallback(
    (ms: number | undefined) => {
      if (!prefs) return;
      persist({ ...prefs, pauseDurationMs: ms });
    },
    [prefs, persist]
  );

  const handleShow = useCallback(() => {
    if (!prefs) return;
    // 唤出时清掉固定位置、解除手动锁定，让它回到角落/恢复漫游。
    const { position: _omit, ...rest } = prefs;
    void _omit;
    userPinnedRef.current = false;
    persist({ ...rest, visible: true });
    const corner = cornerPosition();
    setPosition(corner);
    positionRef.current = corner;
  }, [prefs, persist, cornerPosition]);

  if (!prefs) return null;

  // 隐藏态：角落留小图标重新唤出。
  if (!prefs.visible) {
    return (
      <button
        type="button"
        onClick={handleShow}
        title="唤出像素小狗"
        className="fixed bottom-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-lg shadow-md transition hover:scale-110 hover:bg-amber-200"
      >
        🐕
      </button>
    );
  }

  // 表情决策：忙/喜/悲优先；idle 下走动用 walk、否则 blink/idle。
  let face: PetFace;
  if (status === "busy" || status === "happy" || status === "sad") {
    face = status;
  } else if (isWalking) {
    face = "walk";
  } else if (isBlinking) {
    face = "blink";
  } else {
    face = "idle";
  }

  // 角落浮动：仅在不漫游、未走动、本会话未手动固定时加浮动动画。
  const floating = !canRoam && status === "idle" && !userPinnedRef.current;

  return (
    <>
      <style jsx global>{`
        /* 浮动用整数像素步进（steps），避免缓动产生小数位移导致像素块亚像素白缝。 */
        @keyframes petdog-float {
          0% {
            transform: translateY(0px);
          }
          25% {
            transform: translateY(-2px);
          }
          50% {
            transform: translateY(-4px);
          }
          75% {
            transform: translateY(-2px);
          }
          100% {
            transform: translateY(0px);
          }
        }
        .petdog-float {
          animation: petdog-float 2.4s steps(1, end) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .petdog-float {
            animation: none;
          }
        }
      `}</style>

      <div
        className="group fixed left-0 top-0 z-30 select-none"
        style={{
          // 用整数 translate3d 定位：触发 GPU 层 + 杜绝 left/top 亚像素白线。
          transform: `translate3d(${Math.round(position.x)}px, ${Math.round(position.y)}px, 0)`,
          willChange: "transform",
        }}
      >
        {/* 气泡台词 */}
        {bubble && (
          <div className="absolute bottom-full left-1/2 mb-2 w-max max-w-[200px] -translate-x-1/2 rounded-2xl border border-amber-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-lg">
            {bubble}
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-white" />
          </div>
        )}

        {/* 收起按钮（hover 显示） */}
        <button
          type="button"
          onClick={handleHide}
          title="收起小狗"
          className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-500 opacity-0 shadow transition hover:bg-gray-300 group-hover:opacity-100"
        >
          ×
        </button>

        {/* 小狗本体：可拖动 + 点击；按朝向水平翻转（scaleX 翻转放在内层，与定位 transform 解耦） */}
        <div
          className={`cursor-grab touch-none active:cursor-grabbing ${floating ? "petdog-float" : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            transform: facingRight ? "scaleX(-1)" : "scaleX(1)",
            // 整数倍像素缩放（5x），锁利渲染，避免翻转/缩放时露白边。
            imageRendering: "pixelated",
            lineHeight: 0,
          }}
        >
          <PetDogSprite face={face} scale={PET_CONFIG.scale} walkFrame={walkFrame} />
        </div>
      </div>

      {/* 右上角：小狗设置入口（固定位置，独立于小狗本体） */}
      <div className="fixed right-4 top-16 z-40">
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          title="小狗设置"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-white text-base shadow-md transition hover:scale-110 hover:bg-amber-50"
        >
          🐾
        </button>

        {settingsOpen && (
          <div className="absolute right-0 top-11 w-60 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">🐕 小狗设置</span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {/* 能不能动 */}
            <label className="mb-3 flex cursor-pointer items-center justify-between">
              <span className="text-sm text-gray-700">允许自由走动</span>
              <input
                type="checkbox"
                checked={prefs.roamEnabled !== false}
                onChange={(e) => handleToggleRoam(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
            </label>

            {/* 不能动多久（停顿时长档位） */}
            <div className="mb-3">
              <div className="mb-1.5 text-sm text-gray-700">停下休息时长</div>
              <div className="flex gap-1.5">
                {[
                  { label: "活泼", ms: 600 },
                  { label: "自然", ms: undefined },
                  { label: "慵懒", ms: 4000 },
                  { label: "超懒", ms: 10000 },
                ].map((opt) => {
                  const selected = prefs.pauseDurationMs === opt.ms;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={prefs.roamEnabled === false}
                      onClick={() => handleSetPause(opt.ms)}
                      className={`flex-1 rounded-lg border px-1 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? "border-amber-400 bg-amber-50 font-medium text-amber-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 隐藏 */}
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                handleHide();
              }}
              className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              隐藏小狗
            </button>
          </div>
        )}
      </div>
    </>
  );
}
