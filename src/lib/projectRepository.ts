import type { Project } from "@/types";

export interface ProjectCatalog {
  /** Current-version projects, newest first; equal timestamps use reverse ID order. */
  projects: Project[];
  retainedIncompatibleCount: number;
}

export interface ProjectRepositoryCapabilities {
  readonly driver: string;
  readonly scope: "browser-origin" | "host-local" | "remote";
  readonly entity: "project";
  readonly crossDeviceSync: boolean;
  readonly automaticMigration: boolean;
  readonly streaming: boolean;
}

/** Persistence contract only; authorization/confirmation belongs to domain actions. */
export interface ProjectRepository {
  readonly capabilities: ProjectRepositoryCapabilities;
  /** Never deletes or migrates unrecognized records. */
  readCatalog(): Promise<ProjectCatalog>;
  /** Returns undefined for missing or incompatible records, without rewriting them. */
  getCompatible(id: string): Promise<Project | undefined>;
  /** Rejects invalid input and incompatible ID collisions; must not mutate the input. */
  save(project: Project): Promise<void>;
  /** Callers must obtain any required confirmation before explicitly deleting an ID. */
  deleteExplicit(id: string): Promise<void>;
}
