
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Config, StaffVisit, UserRole } from '../../types';
import Button from '../Shared/Button';
import { useToast } from '../../contexts/ToastContext';
import { ensureISODate } from '../../utils/formatters';

// Quebra as partes da mensagem (string | {shimmer}) em palavras individuais, preservando qual
// trecho já era um destaque {shimmer} -- usado pra animar palavra por palavra (opção D aprovada
// pelo usuário) e deixar TODA a frase brilhando (não só os números em destaque, opção E) depois
// que ela termina de entrar.
type MessagePart = string | { shimmer: string };
const buildWordTokens = (parts: MessagePart[]): { text: string; isShimmerPhrase: boolean }[] => {
  const tokens: { text: string; isShimmerPhrase: boolean }[] = [];
  parts.forEach(part => {
    if (typeof part === 'string') {
      part.split(/(\s+)/).filter(chunk => chunk.length > 0).forEach(chunk => {
        tokens.push({ text: chunk, isShimmerPhrase: false });
      });
    } else {
      tokens.push({ text: part.shimmer, isShimmerPhrase: true });
    }
  });
  return tokens;
};

interface MuralProps {
  config: Config;
  userRole: UserRole;
  onUpdateConfig: (newConfig: Config) => void;
  visits: StaffVisit[];
  pendingReturnsCount: number;
  currentUserFirstName: string;
  // Contagens PESSOAIS do mês (só do capelão logado, não da equipe toda) -- usadas pro
  // lembrete de "ainda não lancei nada disso este mês".
  monthlyStudiesCount: number;
  monthlyClassesCount: number;
  monthlyGroupsCount: number;
  // Mês anterior (pessoal) -- só Estudos/Classes, pra comparar "este mês vs. o passado" em vez
  // de uma meta fixa.
  prevMonthStudiesCount: number;
  prevMonthClassesCount: number;
  // Meta individual de visitas do capelão logado (mesmo cálculo do card "Metas de Visitas") --
  // null enquanto ainda não carregou.
  visitGoal: { expected: number; current: number; deficit: number } | null;
  // Reanima e sorteia uma nova mensagem toda vez que a aba do Dashboard volta a ficar visível
  // (ver isVisible em Dashboard/index.tsx) -- sem isso, a mesma mensagem ficaria travada a
  // sessão inteira, mesmo o pedido sendo "mudar a cada vez que entrar".
  isVisible?: boolean;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const Mural: React.FC<MuralProps> = ({ config, userRole, onUpdateConfig, visits, pendingReturnsCount, currentUserFirstName, monthlyStudiesCount, monthlyClassesCount, monthlyGroupsCount, prevMonthStudiesCount, prevMonthClassesCount, visitGoal, isVisible = true }) => {
  const { showToast } = useToast();
  const [isEditingMural, setIsEditingMural] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [muralDraft, setMuralDraft] = useState(config?.muralText || "");
  const [teamGoalDraft, setTeamGoalDraft] = useState(String(config?.monthlyTeamVisitGoal ?? ''));

  const hasManualText = !!config?.muralText?.trim();

  // --------- Dados ao vivo pras 3 mensagens dinâmicas ---------
  const now = new Date();
  const monthName = MONTH_NAMES[now.getMonth()];
  const monthISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const teamVisitsThisMonth = useMemo(() => {
    return (visits || []).filter(v => ensureISODate(v.date)?.startsWith(monthISO)).length;
  }, [visits, monthISO]);

  const teamGoal = config?.monthlyTeamVisitGoal;
  const teamDeficit = typeof teamGoal === 'number' ? Math.max(teamGoal - teamVisitsThisMonth, 0) : null;

  const daysLeftInMonth = useMemo(() => {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(lastDay - now.getDate(), 0);
  }, [now]);

  type DynamicMessage = { parts: (string | { shimmer: string })[] };

  const dynamicMessages: DynamicMessage[] = useMemo(() => {
    const list: DynamicMessage[] = [];

    // Toda mensagem começa com "Bem-vindo(a), {Nome}!" -- a saudação deixou de ser uma
    // mensagem à parte (era só uma das 7) e virou a abertura fixa de todas elas, sempre
    // seguida do conteúdo específico como uma segunda frase (às vezes uma terceira, nos
    // lembretes, pra ficar mais fácil de lembrar).
    const greeting = `Bem-vindo(a)${currentUserFirstName ? `, ${currentUserFirstName}` : ''}! `;

    // 1. Total de visitas da equipe no mês -- sempre entra no rodízio (dado real, não depende
    // de configuração nenhuma); só ganha o "faltam X pra meta" quando o admin já configurou
    // uma meta mensal. Sem essa parte incondicional, num app recém-configurado (sem meta e sem
    // retornos pendentes) só sobrava a mensagem da contagem regressiva no rodízio inteiro,
    // fazendo parecer que o mural tinha "travado" numa mensagem só.
    list.push({
      parts: teamDeficit !== null && teamDeficit > 0 ? [
        greeting, 'Em ', { shimmer: monthName }, ', a equipe já realizou ', { shimmer: `${teamVisitsThisMonth} visitas` },
        ' -- faltam ', { shimmer: `${teamDeficit}` }, ' para batermos a meta do mês.'
      ] : teamDeficit === 0 ? [
        greeting, { shimmer: `Meta de ${monthName} batida!` }, ' A equipe já realizou ', { shimmer: `${teamVisitsThisMonth} visitas` }, ' este mês. 🙏'
      ] : [
        greeting, 'Em ', { shimmer: monthName }, ', a equipe já realizou ', { shimmer: `${teamVisitsThisMonth} visitas` }, ' -- continue assim!'
      ]
    });

    // 2. Contagem regressiva pro fechamento do mês (lembrete -- duas frases: o fato, depois o
    // que fazer a respeito).
    list.push({
      parts: daysLeftInMonth > 0 ? [
        greeting, 'Faltam ', { shimmer: `${daysLeftInMonth} dia${daysLeftInMonth === 1 ? '' : 's'}` },
        ' para o fechamento de ', { shimmer: monthName }, '. Aproveite para revisar seus registros.'
      ] : [
        greeting, { shimmer: `Último dia de ${monthName}` }, '. Confira se todos os seus registros estão em dia.'
      ]
    });

    // 3. Retornos pendentes -- só entra no rodízio quando existe algum de verdade.
    if (pendingReturnsCount > 0) {
      list.push({
        parts: [
          greeting, 'Estamos em ', { shimmer: monthName }, ' -- ',
          { shimmer: `${pendingReturnsCount} colaborador${pendingReturnsCount === 1 ? '' : 'es'}` }, ' aguardando retorno.'
        ]
      });
    }

    // 4. Lembrete de lançamento pendente (Estudos/Classes/PGs) -- só a partir do 5º dia do mês,
    // pra não soar como cobrança logo no início (é normal ainda não ter nada lançado no dia 2).
    // Duas frases: o que falta, depois o convite pra agir.
    if (now.getDate() >= 5) {
      const missing: string[] = [];
      if (monthlyStudiesCount === 0) missing.push('Estudo Bíblico');
      if (monthlyClassesCount === 0) missing.push('Classe Bíblica');
      if (monthlyGroupsCount === 0) missing.push('Pequeno Grupo');

      if (missing.length > 0) {
        const missingLabel = missing.length === 1
          ? missing[0]
          : `${missing.slice(0, -1).join(', ')} e ${missing[missing.length - 1]}`;
        list.push({
          parts: [
            greeting, 'Ainda sem nenhum registro de ', { shimmer: missingLabel }, ' em ', { shimmer: monthName },
            '. Não esqueça de lançar suas atividades hoje mesmo!'
          ]
        });
      }
    }

    // 5. Alvo individual de visitas (mesmo cálculo do card "Metas de Visitas").
    if (visitGoal) {
      list.push({
        parts: visitGoal.deficit > 0 ? [
          greeting, 'Suas visitas em ', { shimmer: monthName }, ': ', { shimmer: `${visitGoal.current} de ${visitGoal.expected}` },
          ' esperadas -- faltam ', { shimmer: `${visitGoal.deficit}` }, ' pro seu alvo individual.'
        ] : [
          greeting, { shimmer: `Alvo de ${monthName} batido!` }, ' Você já fez ', { shimmer: `${visitGoal.current} visitas` }, ' este mês. 🎉'
        ]
      });
    }

    // 6. Alvo individual de Estudos Bíblicos -- comparado ao mês anterior, não a uma meta fixa.
    if (monthlyStudiesCount > 0 || prevMonthStudiesCount > 0) {
      const delta = monthlyStudiesCount - prevMonthStudiesCount;
      list.push({
        parts: delta > 0 ? [
          greeting, 'Você já registrou ', { shimmer: `${monthlyStudiesCount} Estudos Bíblicos` }, ' em ', { shimmer: monthName },
          ' -- ', { shimmer: `${delta} a mais` }, ' que no mês passado!'
        ] : delta < 0 ? [
          greeting, 'Você registrou ', { shimmer: `${monthlyStudiesCount} Estudos Bíblicos` }, ' em ', { shimmer: monthName },
          ', ', { shimmer: `${Math.abs(delta)} a menos` }, ' que no mês passado.'
        ] : [
          greeting, 'Você já registrou ', { shimmer: `${monthlyStudiesCount} Estudos Bíblicos` }, ' em ', { shimmer: monthName }, ' -- igual ao mês passado.'
        ]
      });
    }

    // 7. Alvo individual de Classes Bíblicas -- mesma lógica, comparado ao mês anterior.
    if (monthlyClassesCount > 0 || prevMonthClassesCount > 0) {
      const delta = monthlyClassesCount - prevMonthClassesCount;
      list.push({
        parts: delta > 0 ? [
          greeting, 'Você já registrou ', { shimmer: `${monthlyClassesCount} Classes Bíblicas` }, ' em ', { shimmer: monthName },
          ' -- ', { shimmer: `${delta} a mais` }, ' que no mês passado!'
        ] : delta < 0 ? [
          greeting, 'Você registrou ', { shimmer: `${monthlyClassesCount} Classes Bíblicas` }, ' em ', { shimmer: monthName },
          ', ', { shimmer: `${Math.abs(delta)} a menos` }, ' que no mês passado.'
        ] : [
          greeting, 'Você já registrou ', { shimmer: `${monthlyClassesCount} Classes Bíblicas` }, ' em ', { shimmer: monthName }, ' -- igual ao mês passado.'
        ]
      });
    }

    return list;
  }, [teamDeficit, teamVisitsThisMonth, monthName, daysLeftInMonth, pendingReturnsCount, currentUserFirstName, monthlyStudiesCount, monthlyClassesCount, monthlyGroupsCount, prevMonthStudiesCount, prevMonthClassesCount, visitGoal]);

  const [messageIndex, setMessageIndex] = useState(0);
  // Sem isso, o primeiro sorteio da sessão comparava contra o valor inicial do estado (0) como
  // se já fosse "a mensagem anterior" -- na prática, a mensagem de índice 0 nunca podia vencer
  // o primeiro sorteio, só a partir do segundo. Só ativa a lógica de "não repetir" depois do
  // primeiro sorteio de verdade.
  const hasPickedRef = React.useRef(false);

  useEffect(() => {
    if (!isVisible || dynamicMessages.length === 0) return;
    setMessageIndex(prev => {
      if (dynamicMessages.length === 1) return 0;
      let next = Math.floor(Math.random() * dynamicMessages.length);
      if (hasPickedRef.current && next === prev) next = (next + 1) % dynamicMessages.length;
      hasPickedRef.current = true;
      return next;
    });
    // Só quando a aba fica visível de novo -- não a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  const activeMessage = dynamicMessages[messageIndex] || dynamicMessages[0];

  // As palavras entram em amarelo sólido (mais forte/legível durante o movimento) e só viram o
  // brilho animado (shimmer-text) depois que a última palavra termina de entrar -- shimmer e
  // motion juntos desde o início deixavam o efeito "sujo" (a cor já saindo semitransparente
  // enquanto ainda estava subindo/aparecendo).
  const [entranceDone, setEntranceDone] = useState(false);
  useEffect(() => {
    setEntranceDone(false);
    if (!activeMessage) return;
    const wordCount = buildWordTokens(activeMessage.parts).filter(t => !/^\s+$/.test(t.text)).length;
    // Mesma matemática do delay escalonado + duração de cada motion.span abaixo (35ms por
    // palavra + 350ms de duração), com uma folga de 150ms.
    const timer = setTimeout(() => setEntranceDone(true), wordCount * 35 + 350 + 150);
    return () => clearTimeout(timer);
  }, [messageIndex, activeMessage]);

  const handleSaveMural = async () => {
    setIsSaving(true);
    try {
      const parsedGoal = teamGoalDraft.trim() === '' ? undefined : Math.max(0, parseInt(teamGoalDraft, 10) || 0);
      await onUpdateConfig({ ...config, muralText: muralDraft, monthlyTeamVisitGoal: parsedGoal });
      setIsEditingMural(false);
      showToast("Mural atualizado com sucesso!", "success");
    } catch (e) {
      showToast("Erro ao atualizar mural.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-[#005a9c] p-4 md:p-5 rounded-3xl shadow-sm relative overflow-hidden border-none">
      <div className="relative z-10 flex items-start justify-between gap-4">
        {isEditingMural ? (
          <div className="space-y-3 w-full">
            <textarea
              value={muralDraft}
              onChange={e => setMuralDraft(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-2xl p-3 text-white focus:ring-2 focus:ring-amber-400/50 outline-none placeholder-white/40 transition-all"
              rows={2}
              placeholder="Escreva um comunicado... (deixe em branco pra voltar às mensagens automáticas)"
            />
            <div>
              <label className="block text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">
                Meta mensal de visitas da equipe (usada nas mensagens automáticas)
              </label>
              <input
                type="number"
                min={0}
                value={teamGoalDraft}
                onChange={e => setTeamGoalDraft(e.target.value)}
                placeholder="Ex: 60"
                className="w-32 bg-white/10 border border-white/20 rounded-xl p-2 text-white text-sm focus:ring-2 focus:ring-amber-400/50 outline-none placeholder-white/40 transition-all"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSaveMural}
                isLoading={isSaving}
                className="px-5 py-2 bg-amber-400 text-slate-900 shadow-amber-400/20"
              >
                Publicar
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsEditingMural(false)}
                className="px-5 py-2 bg-white/20 text-white hover:bg-white/30"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-3">
            <div className="w-8 h-8 shrink-0 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <i className="fas fa-bullhorn text-amber-400 text-xs"></i>
            </div>
            <p className="text-white leading-relaxed font-medium text-sm">
              {hasManualText ? (
                config.muralText
              ) : activeMessage ? (
                // key={messageIndex}: remonta do zero a cada troca de mensagem, senão as
                // palavras não teriam como "entrar" de novo (React só atualizaria o texto).
                <span key={messageIndex}>
                  {buildWordTokens(activeMessage.parts).map((token, i) =>
                    /^\s+$/.test(token.text) ? (
                      <React.Fragment key={i}>{token.text}</React.Fragment>
                    ) : (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.035, duration: 0.35, ease: 'easeOut' }}
                        className={`inline-block font-black ${entranceDone ? 'shimmer-text' : 'text-amber-400'}`}
                      >
                        {token.text}
                      </motion.span>
                    )
                  )}
                </span>
              ) : (
                "Nenhum aviso no momento."
              )}
            </p>
          </div>
        )}

        {!isEditingMural && userRole === UserRole.ADMIN && (
          <button onClick={() => setIsEditingMural(true)} className="shrink-0 w-8 h-8 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center border border-white/10">
            <i className="fas fa-edit text-[10px]"></i>
          </button>
        )}
      </div>
    </section>
  );
};

export default Mural;
