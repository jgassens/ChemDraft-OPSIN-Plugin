/**
 * @chemdraft/plugin-opsin-name-to-structure — public surface.
 *
 * The plugin owns no chemistry engine. OPSIN lives in the host and is reached through
 * `chemistry.compute`, so everything here is the shape of a request, the shape of an answer, and how
 * that answer is rendered.
 */
export {
  opsinPluginManifest,
  opsinPluginId,
  opsinConvertCommandId,
  opsinPanelId,
  opsinNameToStructureAnalysisType
} from "./manifest";

export {
  validateName,
  MAX_NAME_LENGTH,
  type NameConversionOutcome,
  type EngineIdentity
} from "./domain/contracts";

export { convertName } from "./application/convertName";
export { composeConversionReport } from "./report/composeConversionReport";
export {
  createOpsinRegistration,
  createOpsinCommandHandlers,
  type OpsinPluginServices,
  type OpsinPluginRegistration
} from "./register";
