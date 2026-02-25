import { CreaturePF2e, ScenePF2e, TokenDocumentPF2e, TokenPF2e } from "foundry-helpers";

type ControlledToken = TokenPF2e<TokenDocumentPF2e<ScenePF2e>> & {
    actor: CreaturePF2e;
};

export type { ControlledToken };
