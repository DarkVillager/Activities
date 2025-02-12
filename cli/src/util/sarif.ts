import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { getPackageJson } from './getPackageJson.js'

export enum SarifRuleId {
  bumpCheck = 'bump-check',
  typeCheck = 'type-check',
  iframeCheck = 'iframe-check',
  iframeRegexpCheck = 'iframe-regexp-check',
  languageCheck = 'language-check',
  serviceFolderCheck = 'service-folder-check',
  imageSizeCheck = 'image-size-check',
  imageMimeTypeCheck = 'image-mime-type-check',
}

const sarifRules: Record<SarifRuleId, ReportingDescriptor> = {
  [SarifRuleId.bumpCheck]: {
    id: SarifRuleId.bumpCheck,
    name: 'Bump Check',
    shortDescription: {
      text: 'Makes sure the version is bumped',
    },
  },
  [SarifRuleId.typeCheck]: {
    id: SarifRuleId.typeCheck,
    name: 'Type Check',
    shortDescription: {
      text: 'Makes sure the TypeScript files are correct',
    },
  },
  [SarifRuleId.iframeCheck]: {
    id: SarifRuleId.iframeCheck,
    name: 'iFrame Check',
    shortDescription: {
      text: 'Makes sure the `iframe` metadata property is correct',
    },
  },
  [SarifRuleId.iframeRegexpCheck]: {
    id: SarifRuleId.iframeRegexpCheck,
    name: 'iFrame Regexp Check',
    shortDescription: {
      text: 'Makes sure the `iframeRegexp` metadata property is correct',
    },
  },
  [SarifRuleId.languageCheck]: {
    id: SarifRuleId.languageCheck,
    name: 'Language Check',
    shortDescription: {
      text: 'Makes sure the `language` metadata property is correct',
    },
  },
  [SarifRuleId.serviceFolderCheck]: {
    id: SarifRuleId.serviceFolderCheck,
    name: 'Service Folder Check',
    shortDescription: {
      text: 'Makes sure the service folder is correct',
    },
  },
  [SarifRuleId.imageSizeCheck]: {
    id: SarifRuleId.imageSizeCheck,
    name: 'Image Check',
    shortDescription: {
      text: 'Makes sure all images (logo and URLs) are exactly 512x512 pixels',
    },
  },
  [SarifRuleId.imageMimeTypeCheck]: {
    id: SarifRuleId.imageMimeTypeCheck,
    name: 'Image MIME Type Check',
    shortDescription: {
      text: 'Makes sure all images (logo and URLs) have the correct MIME type',
    },
  },
}

const sarifLog: SARIF = {
  $schema: 'http://json.schemastore.org/sarif-2.1.0-rtm.5',
  version: '2.1.0',
  runs: [
    {
      tool: {
        driver: {
          name: 'pmd',
          organization: 'PreMiD',
          informationUri: 'https://premid.app',
          rules: [],
        },
      },
      results: [],
    },
  ],
}

const sarifFiles: Record<string, Artifact> = {}
const sarifArtifactIndices: Record<string, number> = {}
const sarifRuleIndices: Record<string, number> = {}
let nextArtifactIndex = 0
let nextRuleIndex = 0

export function addSarifLog(log: {
  path: string
  message: string
  ruleId: SarifRuleId
  position: {
    line: number
    column: number
  }
}) {
  log.path = log.path.replace(process.cwd(), '')
  if (!sarifLog.runs[0].tool.driver.semanticVersion) {
    getPackageJson().then((packageJson) => {
      sarifLog.runs[0].tool.driver.semanticVersion = packageJson.version
    })
  }

  if (typeof sarifArtifactIndices[log.path] === 'undefined') {
    sarifArtifactIndices[log.path] = nextArtifactIndex++

    // Create a new entry in the files dictionary.
    sarifFiles[log.path] = {
      location: {
        uri: pathToFileURL(log.path).toString(),
      },
    }
  }

  if (typeof sarifRuleIndices[log.ruleId] === 'undefined') {
    sarifRuleIndices[log.ruleId] = nextRuleIndex++
  }

  const sarifRepresentation: Result = {
    level: 'error',
    message: {
      text: log.message,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: pathToFileURL(log.path),
            index: sarifArtifactIndices[log.path],
          },
          ...(log.position && log.position.line > 0
            ? {
                region: {
                  startLine: log.position.line,
                  ...(log.position.column > 0 && { startColumn: log.position.column }),
                },
              }
            : {}
          ),
        },
      },
    ],
    ruleId: log.ruleId,
    ruleIndex: sarifRuleIndices[log.ruleId],
  }

  sarifLog.runs[0].results?.push(sarifRepresentation)
}

export async function writeSarifLog() {
  if (Object.keys(sarifFiles).length > 0) {
    sarifLog.runs[0].artifacts = []

    for (const path of Object.keys(sarifFiles)) {
      sarifLog.runs[0].artifacts.push(sarifFiles[path])
    }
  }

  const usedRules = new Set<string>(sarifLog.runs[0].results?.map(result => result.ruleId!).filter(Boolean) ?? [])
  if (Object.keys(sarifRules).length > 0) {
    for (const ruleId of Object.keys(sarifRules)) {
      if (usedRules.has(ruleId)) {
        sarifLog.runs[0].tool.driver.rules?.push(sarifRules[ruleId as SarifRuleId])
      }
    }
  }

  await writeFile(resolve(process.cwd(), 'pmd-results.sarif'), JSON.stringify(sarifLog, null, 2))
}

/**
 * Static Analysis Results Format (SARIF) Version 2.1.0-rtm.5 JSON Schema: a standard format for the output of static analysis tools.
 */
interface SARIF {
  /**
   * The URI of the JSON schema corresponding to the version.
   */
  $schema?: string
  /**
   * The SARIF format version of this log file.
   */
  version: '2.1.0'
  /**
   * The set of runs contained in this log file.
   */
  runs: Run[]
}
/**
 * Describes a single run of an analysis tool, and contains the reported output of that run.
 */
interface Run {
  /**
   * Information about the tool or tool pipeline that generated the results in this run. A run can only contain results produced by a single tool or tool pipeline. A run can aggregate results from multiple log files, as long as context around the tool run (tool command-line arguments and the like) is identical for all aggregated files.
   */
  tool: {
    /**
     * The analysis tool that was run.
     */
    driver: {
      /**
       * The name of the tool component.
       */
      name: string
      /**
       * The organization or company that produced the tool component.
       */
      organization?: string
      /**
       * The tool component version in the format specified by Semantic Versioning 2.0.
       */
      semanticVersion?: string
      /**
       * The absolute URI at which information about this version of the tool component can be found.
       */
      informationUri?: string
      /**
       * An array of reportingDescriptor objects relevant to the analysis performed by the tool component.
       */
      rules?: ReportingDescriptor[]
    }
  }
  /**
   * An array of artifact objects relevant to the run.
   */
  artifacts?: Artifact[]
  /**
   * The set of results contained in an SARIF log. The results array can be omitted when a run is solely ng rules metadata. It must be present (but may be empty) if a log file represents an actual scan.
   */
  results?: Result[]
}
/**
 * Metadata that describes a specific report produced by the tool, as part of the analysis it provides or its runtime reporting.
 */
interface ReportingDescriptor {
  /**
   * A stable, opaque identifier for the report.
   */
  id: string
  /**
   * A report identifier that is understandable to an end user.
   */
  name?: string
  /**
   * A message string or message format string rendered in multiple formats.
   */
  shortDescription?: {
    /**
     * A plain text message string or format string.
     */
    text: string
  }
}

/**
 * A location within a programming artifact.
 */
interface Location {
  /**
   * Value that distinguishes this location from all other locations within a single result object.
   */
  id?: number
  /**
   * Identifies the artifact and region.
   */
  physicalLocation?:
    | {
      [k: string]: unknown
    }
}
/**
 * A single artifact. In some cases, this artifact might be nested within another artifact.
 */
interface Artifact {
  /**
   * The location of the artifact.
   */
  location?: {
    /**
     * A string containing a valid relative or absolute URI.
     */
    uri?: string
  }
}
/**
 * A result produced by an analysis tool.
 */
interface Result {
  /**
   * The stable, unique identifier of the rule, if any, to which this result is relevant.
   */
  ruleId?: string
  /**
   * The index within the tool component rules array of the rule object associated with this result.
   */
  ruleIndex?: number
  /**
   * A value specifying the severity level of the result.
   */
  level?: 'none' | 'note' | 'warning' | 'error'
  /**
   * A message that describes the result. The first sentence of the message only will be displayed when visible space is limited.
   */
  message:
    | {
      [k: string]: unknown
    }
  /**
   * The set of locations where the result was detected. Specify only one location unless the problem indicated by the result can only be corrected by making a change at every specified location.
   */
  locations?: Location[]
}
