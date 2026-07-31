"use client";

import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { criarLancamento, type EstadoLancamento } from "@/app/(app)/lancamentos/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { SegmentedField, Select } from "@/components/ui/select";

type Opcao = { id: string; nome: string; tipo?: string };

export function FormLancamento({
  contas,
  cartoes,
  categorias,
  dataPadrao,
  temParceiro,
}: {
  contas: Opcao[];
  cartoes: Opcao[];
  categorias: (Opcao & { tipo: string })[];
  dataPadrao: string;
  temParceiro: boolean;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState<EstadoLancamento, FormData>(
    criarLancamento,
    {},
  );

  const [tipo, setTipo] = useState("expense");
  const [titularidade, setTitularidade] = useState("conjunto");

  // As categorias sao separadas por natureza: oferecer "Salário" numa despesa
  // so' polui a lista e convida ao erro de classificacao.
  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  useEffect(() => {
    if (estado.ok) {
      router.push("/lancamentos");
      router.refresh();
    }
  }, [estado.ok, router]);

  return (
    <form action={acao} className="space-y-4">
      <SegmentedField
        name="tipo"
        valor={tipo}
        aoMudar={setTipo}
        disabled={pendente}
        opcoes={[
          { valor: "expense", rotulo: "Saída", tom: "expense" },
          { valor: "income", rotulo: "Entrada", tom: "income" },
        ]}
      />

      <div>
        <Label htmlFor="valor">Valor</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
            R$
          </span>
          <Input
            id="valor"
            name="valor"
            // inputMode decimal abre o teclado numerico no celular sem
            // bloquear a digitacao de virgula, que o pt-BR usa.
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            className="tabular pl-11 text-[17px] font-semibold"
            disabled={pendente}
            required
            autoFocus
          />
        </div>
      </div>

      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Input
          id="descricao"
          name="descricao"
          placeholder="Mercado, aluguel, salário..."
          autoComplete="off"
          disabled={pendente}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            name="data"
            type="date"
            defaultValue={dataPadrao}
            disabled={pendente}
            required
          />
        </div>

        <div>
          <Label htmlFor="categoriaId">Categoria</Label>
          <Select id="categoriaId" name="categoriaId" disabled={pendente} defaultValue="">
            <option value="">Sem categoria</option>
            {categoriasDoTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="origem">De onde saiu</Label>
        {/* Um campo so' para conta e cartao: como sao mutuamente exclusivos,
            dois selects permitiriam preencher os dois e criar estado invalido. */}
        <Select id="origem" name="origem" disabled={pendente} defaultValue="">
          <option value="">Não vincular (não afeta saldo)</option>
          {contas.length > 0 && (
            <optgroup label="Contas">
              {contas.map((c) => (
                <option key={c.id} value={`conta:${c.id}`}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          )}
          {cartoes.length > 0 && tipo === "expense" && (
            <optgroup label="Cartões de crédito">
              {cartoes.map((c) => (
                <option key={c.id} value={`cartao:${c.id}`}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          )}
        </Select>

        {contas.length === 0 && cartoes.length === 0 && (
          <p className="mt-1.5 text-[12.5px] text-muted">
            Você ainda não tem contas nem cartões. O lançamento é registrado mesmo assim, mas nenhum
            saldo é movimentado.
          </p>
        )}
        {cartoes.length > 0 && tipo === "expense" && (
          <p className="mt-1.5 text-[12.5px] text-muted">
            Compra no cartão entra na fatura do ciclo e não altera o saldo agora — o dinheiro sai
            quando a fatura for paga.
          </p>
        )}
      </div>

      {temParceiro && (
        <div>
          <Label>De quem é</Label>
          <SegmentedField
            name="titularidade"
            valor={titularidade}
            aoMudar={setTitularidade}
            disabled={pendente}
            opcoes={[
              { valor: "conjunto", rotulo: "Conjunto" },
              { valor: "meu", rotulo: "Só meu" },
            ]}
          />
        </div>
      )}
      {!temParceiro && <input type="hidden" name="titularidade" value="conjunto" />}

      <div>
        <Label htmlFor="observacao">Observação (opcional)</Label>
        <Input
          id="observacao"
          name="observacao"
          placeholder="Algum detalhe que você queira lembrar"
          disabled={pendente}
        />
      </div>

      <FieldError>{estado.erro}</FieldError>

      <Button type="submit" size="lg" className="w-full" disabled={pendente}>
        {pendente ? (
          <>
            <SpinnerGapIcon size={17} className="animate-spin" />
            Salvando...
          </>
        ) : (
          "Salvar lançamento"
        )}
      </Button>
    </form>
  );
}
