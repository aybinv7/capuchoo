/** rrweb's serialized node shapes (`@rrweb/types` 2.1.7), restated so the recorder ships no type dependency. */
export const NodeKind = {
  Document: 0,
  DocumentType: 1,
  Element: 2,
  Text: 3,
  CDATA: 4,
  Comment: 5,
} as const;

/** The id rrweb gives a node it deliberately leaves out of the recording (slim DOM, head whitespace). */
export const IGNORED_NODE = -2;

export type Attributes = Record<string, string | number | boolean | null | undefined>;

interface Common {
  id: number;
  rootId?: number;
  isShadowHost?: boolean;
  isShadow?: boolean;
}

export interface SerializedDocument extends Common {
  type: typeof NodeKind.Document;
  childNodes: SerializedNode[];
  compatMode?: string;
}

export interface SerializedDocumentType extends Common {
  type: typeof NodeKind.DocumentType;
  name: string;
  publicId: string;
  systemId: string;
}

export interface SerializedElement extends Common {
  type: typeof NodeKind.Element;
  tagName: string;
  attributes: Attributes;
  childNodes: SerializedNode[];
  isSVG?: true;
  isCustom?: true;
}

export interface SerializedText extends Common {
  type: typeof NodeKind.Text;
  textContent: string;
}

export interface SerializedLeaf extends Common {
  type: typeof NodeKind.CDATA | typeof NodeKind.Comment;
  textContent: string;
}

export type SerializedNode =
  | SerializedDocument
  | SerializedDocumentType
  | SerializedElement
  | SerializedText
  | SerializedLeaf;

export type SerializedParent = SerializedDocument | SerializedElement;

/** The subset of rrweb's `Mirror` a snapshot reads and writes; `record.mirror` satisfies it. */
export interface SnapshotMirror {
  getId(node: Node): number;
  hasNode(node: Node): boolean;
  add(node: Node, meta: SerializedNode): void;
}

export interface SlimDOMOptions {
  script?: boolean;
  comment?: boolean;
  headFavicon?: boolean;
  headWhitespace?: boolean;
  headMetaDescKeywords?: boolean;
  headMetaSocial?: boolean;
  headMetaRobots?: boolean;
  headMetaHttpEquiv?: boolean;
  headMetaAuthorship?: boolean;
  headMetaVerification?: boolean;
}

/** What decides how a node is written down: the same settings the replay track gives rrweb. */
export interface SerializeSettings {
  maskTextSelector: string;
  blockSelector: string;
  /** Per input type or tag, `true` when its value is masked. */
  maskInputOptions: Record<string, boolean>;
  slimDOM: SlimDOMOptions;
}

/** What a node inherits from its parent while it is serialized. */
export interface NodeContext {
  /** `undefined` only for the root, where masking is looked up through the ancestors. */
  needsMask: boolean | undefined;
  preserveWhiteSpace: boolean;
  cssCaptured: boolean;
}
