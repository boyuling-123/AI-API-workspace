import type { ProjectRepository } from "@/lib/projectRepository";
import { isCompatibleProject } from "@/lib/projectStoragePolicy";
import { deleteProject, getProject, readProjectCatalog, saveProject } from "@/services/db";

/** The existing browser-origin store, not a migration or new backend. */
export const indexedDbProjectRepository: ProjectRepository = Object.freeze({
  capabilities: Object.freeze({
    driver: "indexeddb",
    scope: "browser-origin",
    entity: "project",
    crossDeviceSync: false,
    automaticMigration: false,
    streaming: false,
  }),
  readCatalog: readProjectCatalog,
  async getCompatible(id: string) {
    const project = await getProject(id);
    return isCompatibleProject(project) ? project : undefined;
  },
  save: saveProject,
  deleteExplicit: deleteProject,
});
