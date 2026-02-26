
export type ProposalStatus = 'Rascunho' | 'Processada' | 'Confirmada';

export interface Proposal {
    id: string;
    cliente_nome: string;
    cidade: string;
    medidas_input: string;
    observacoes?: string;
    status: ProposalStatus;
    total_geral?: number;
    pdf_gerado?: string;
    criado_por?: string;
    data_criacao: string;
    data_confirmacao?: string;
    prompts?: any[]; // JSON array
    input_image_url?: string;
    whatsapp?: string;
}

export interface ProposalItem {
    id: string;
    proposta_id: string;
    nome_ambiente: string;
    largura: number;
    altura: number;
    area_m2: number;
    valor_unitario: number;
    valor_total: number;
    ordem: number;
    price_rule?: string; // Not in DB strictly but used in logic, maybe add to json or separate col?
    // DB has specific cols. 'price_rule' is not in ItemProposta DB schema from list_tables.
    // Wait, list_tables showed: nome_ambiente, largura, altura, area_m2, valor_unitario, valor_total, ordem.
    // No price_rule. I might need to store it in a json column or just infer it?
    // For now, let's stick to DB columns.
}

export interface AIProcessingResult {
    id: string;
    proposta_id: string;
    medidas_normalizadas?: string;
    mockup_ascii?: string;
    tabela_precos?: string;
    logica_calculo?: string;
    total_calculado?: number;
    data_processamento: string;
}

export interface CreateProposalInput {
    clientName: string;
    city: string;
    measurements: string;
    observations?: string;
    imageUrl?: string;
    whatsapp?: string;
}
