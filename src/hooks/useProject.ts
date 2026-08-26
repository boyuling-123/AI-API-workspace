"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/types";
import {
  db,
  isQuotaExceededError,
  listCompatibleProjects,
  saveProject,
} from "@/services/db";
import { createEmptyProject } from "@/services/projectFactory";

const AUTO_SAVE_DEBOUNCE_MS = 600;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface ProjectUpdateOptions {
  immediate?: boolean;
}

export interface UseProjectResult {
  project: Project | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  isLoaded: boolean;
  updateProject: (
    updater: (current: Project) => Project,
    options?: ProjectUpdateOptions
  ) => void;
  replaceProject: (next: Project) => void;
  createNew: (name?: string) => void;
}

/**
 * 当前项目状态管理 + IndexedDB debounce 自动保存。
 * 写入失败（含配额超限）会捕获并通过 saveError 暴露提示。
 */
export function useProject(): UseProjectResult {
  const [project, setProject] = useState<Project | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const projectRef = useRef<Project | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const latestSaveId = useRef(0);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // 防止 React 18 StrictMode 下 effect 双执行导致重复初始化。
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    async function loadInitial() {
      try {
        // 仅加载与当前 schema 兼容的项目；不兼容的旧版记录已在此步被清理。
        const projects = await listCompatibleProjects();
        if (projects.length > 0) {
          projectRef.current = projects[0];
          setProject(projects[0]);
        } else {
          const initial = createEmptyProject();
          await saveProject(initial);
          projectRef.current = initial;
          setProject(initial);
        }
      } catch (error) {
        // IndexedDB 不可用（如隐私模式）时降级为内存项目，至少保证页面可用。
        console.error("加载本地项目失败，降级为内存项目：", error);
        const fallback = createEmptyProject();
        projectRef.current = fallback;
        setProject(fallback);
        setSaveError("本地存储不可用，数据将不会自动保存，请注意导出备份");
      } finally {
        setIsLoaded(true);
      }
    }

    loadInitial();
  }, []);

  const enqueueSave = useCallback((next: Project) => {
    const saveId = latestSaveId.current + 1;
    latestSaveId.current = saveId;
    setSaveStatus("saving");
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await saveProject(next);
        if (saveId === latestSaveId.current) {
          setSaveStatus("saved");
          setSaveError(null);
        }
      } catch (error) {
        if (saveId !== latestSaveId.current) {
          return;
        }
        setSaveStatus("error");
        const message = isQuotaExceededError(error)
          ? "存储空间不足，建议改用 URL 图片或导出备份"
          : error instanceof Error
            ? `保存失败：${error.message}`
            : "保存失败：未知错误";
        setSaveError(message);
      }
    });
  }, []);

  const scheduleSave = useCallback((next: Project) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setSaveStatus("saving");
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      enqueueSave(next);
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [enqueueSave]);

  const updateProject = useCallback(
    (
      updater: (current: Project) => Project,
      options: ProjectUpdateOptions = {}
    ) => {
      const current = projectRef.current;
      if (!current) {
        return;
      }
      const updated = { ...updater(current), updateTime: Date.now() };
      projectRef.current = updated;
      setProject(updated);
      if (options.immediate) {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
        enqueueSave(updated);
      } else {
        scheduleSave(updated);
      }
    },
    [enqueueSave, scheduleSave]
  );

  const replaceProject = useCallback(
    (next: Project) => {
      const updated = { ...next, updateTime: Date.now() };
      projectRef.current = updated;
      setProject(updated);
      scheduleSave(updated);
    },
    [scheduleSave]
  );

  const createNew = useCallback(
    (name?: string) => {
      const fresh = createEmptyProject(name);
      projectRef.current = fresh;
      setProject(fresh);
      scheduleSave(fresh);
    },
    [scheduleSave]
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    // 占位：保留 db 引用，避免未来 tree-shaking 误删；同时确保数据库初始化。
    void db;
  }, []);

  return {
    project,
    saveStatus,
    saveError,
    isLoaded,
    updateProject,
    replaceProject,
    createNew,
  };
}
