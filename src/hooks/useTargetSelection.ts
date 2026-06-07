"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getTargetSelection,
  saveTargetSelection,
} from "@/services/draftDb";

/**
 * 已选目标管理。targetIds 跟随项目持久化，刷新可恢复。
 */
export function useTargetSelection(projectId: string) {
  const [targetIds, setTargetIdsState] = useState<string[]>([]);
  const loadedProjectId = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId || loadedProjectId.current === projectId) {
      return;
    }
    loadedProjectId.current = projectId;
    getTargetSelection(projectId)
      .then((ids) => setTargetIdsState(ids))
      .catch((error) => console.error("加载目标选择失败：", error));
  }, [projectId]);

  const setTargetIds = useCallback(
    (ids: string[]) => {
      setTargetIdsState(ids);
      saveTargetSelection(projectId, ids).catch((error) =>
        console.error("保存目标选择失败：", error)
      );
    },
    [projectId]
  );

  return { targetIds, setTargetIds };
}
