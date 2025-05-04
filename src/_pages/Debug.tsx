// Debug.tsx - Renomeado conceitualmente para "Análise Adicional"
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";
import ScreenshotQueue from "../components/Queue/ScreenshotQueue";
import SolutionCommands from "../components/Solutions/SolutionCommands";
import { Screenshot } from "../types/screenshots";
import { ComplexitySection, ContentSection } from "./Solutions";
import { useToast } from "../contexts/toast";

// Componente para renderizar conteúdo com blocos de código
const ContentRenderer = ({
  content,
  isLoading,
  currentLanguage,
}: {
  content: string;
  isLoading: boolean;
  currentLanguage: string;
}) => {
  // Função auxiliar para detectar se há blocos de código na resposta
  const hasCodeBlocks = (text: string) => /```[\s\S]*?```/.test(text);

  // Função para renderizar texto com blocos de código Markdown
  const renderWithCodeBlocks = (text: string) => {
    if (!text) return null;

    // Dividir o texto em pedaços: texto normal e blocos de código
    const segments = text.split(/(```(?:[\w]*)?[\s\S]*?```)/g);

    return segments.map((segment, idx) => {
      // Verificar se é um bloco de código
      if (segment.startsWith("```") && segment.endsWith("```")) {
        // Extrair a linguagem e o código
        const languageMatch = segment.match(/```([\w]*)?/);
        const codeLanguage =
          languageMatch && languageMatch[1]
            ? languageMatch[1]
            : currentLanguage;

        // Extrair o código sem os delimitadores
        const code = segment
          .replace(/```(?:[\w]*)?/, "") // Remove o marcador de abertura com linguagem
          .replace(/```$/, "") // Remove o marcador de fechamento
          .trim();

        return (
          <div key={idx} className="my-4 w-full">
            <SyntaxHighlighter
              showLineNumbers
              language={codeLanguage === "golang" ? "go" : codeLanguage}
              style={dracula}
              customStyle={{
                maxWidth: "100%",
                margin: 0,
                padding: "1rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                backgroundColor: "rgba(22, 27, 34, 0.5)",
              }}
              wrapLongLines={true}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        );
      } else {
        // Renderizar texto normal com quebras de linha preservadas
        return segment ? (
          <div key={idx} className="whitespace-pre-wrap my-2">
            {segment}
          </div>
        ) : null;
      }
    });
  };

  return (
    <div className="space-y-2 relative">
      <h2 className="text-[13px] font-medium text-white tracking-wide"></h2>
      {isLoading ? (
        <div className="space-y-1.5">
          <div className="mt-4 flex">
            <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
              Carregando análise...
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full">
          {hasCodeBlocks(content) ? (
            renderWithCodeBlocks(content)
          ) : (
            <SyntaxHighlighter
              showLineNumbers
              language={currentLanguage == "golang" ? "go" : currentLanguage}
              style={dracula}
              customStyle={{
                maxWidth: "100%",
                margin: 0,
                padding: "1rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                backgroundColor: "rgba(22, 27, 34, 0.5)",
              }}
              wrapLongLines={true}
            >
              {content as string}
            </SyntaxHighlighter>
          )}
        </div>
      )}
    </div>
  );
};

async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const existing = await window.electronAPI.getScreenshots();
    console.log("Raw screenshot data in Debug:", existing);
    return (Array.isArray(existing) ? existing : []).map((p) => ({
      id: p.path,
      path: p.path,
      preview: p.preview,
      timestamp: Date.now(),
    }));
  } catch (error) {
    console.error("Error loading screenshots:", error);
    throw error;
  }
}

interface DebugProps {
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  currentLanguage: string;
  setLanguage: (language: string) => void;
}

const Debug: React.FC<DebugProps> = ({
  isProcessing,
  setIsProcessing,
  currentLanguage,
  setLanguage,
}) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const { showToast } = useToast();

  const { data: screenshots = [], refetch } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [newCode, setNewCode] = useState<string | null>(null);
  const [debugContent, setDebugContent] = useState<string | null>(null);
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null);
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  );
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  );
  const [debugAnalysis, setDebugAnalysis] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Try to get the new solution data from cache first
    const newSolution = queryClient.getQueryData(["new_solution"]) as {
      code: string;
      content: string;
      debug_analysis: string;
      thoughts: string[];
      time_complexity: string;
      space_complexity: string;
    } | null;

    // If we have cached data, set all state variables to the cached data
    if (newSolution) {
      console.log("Found cached debug solution:", newSolution);

      if (newSolution.debug_analysis) {
        // Store the debug analysis in its own state variable
        setDebugAnalysis(newSolution.debug_analysis);
        setDebugContent(newSolution.content || newSolution.debug_analysis);
        // Set code separately for the code section
        setNewCode(
          newSolution.code ||
            "// Modo de análise adicional - veja a análise abaixo"
        );

        // Process thoughts/analysis points
        if (newSolution.debug_analysis.includes("\n\n")) {
          const sections = newSolution.debug_analysis
            .split("\n\n")
            .filter(Boolean);
          // Pick first few sections as thoughts
          setThoughtsData(sections.slice(0, 3));
        } else {
          setThoughtsData([
            "Análise adicional baseada nas suas capturas de tela",
          ]);
        }
      } else {
        // Fallback to code or default
        setNewCode(newSolution.code || "// Nenhuma análise disponível");
        setDebugContent(newSolution.content || "");
        setThoughtsData(
          newSolution.thoughts || [
            "Análise adicional baseada nas suas capturas de tela",
          ]
        );
      }
      setTimeComplexityData(
        newSolution.time_complexity || "N/A - Modo de análise adicional"
      );
      setSpaceComplexityData(
        newSolution.space_complexity || "N/A - Modo de análise adicional"
      );
      setIsProcessing(false);
    }

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onDebugSuccess((data) => {
        console.log("Debug success event received with data:", data);
        queryClient.setQueryData(["new_solution"], data);

        // Also update local state for immediate rendering
        if (data.debug_analysis) {
          // Store the debug analysis in its own state variable
          setDebugAnalysis(data.debug_analysis);
          setDebugContent(data.content || data.debug_analysis);
          // Set code separately for the code section
          setNewCode(
            data.code || "// Modo de análise adicional - veja a análise abaixo"
          );

          // Process thoughts/analysis points
          if (data.debug_analysis.includes("\n\n")) {
            const sections = data.debug_analysis.split("\n\n").filter(Boolean);
            // Pick first few sections as thoughts
            setThoughtsData(sections.slice(0, 3));
          } else if (data.debug_analysis.includes("\n")) {
            // Try to find bullet points or numbered lists
            const lines = data.debug_analysis.split("\n");
            const bulletPoints = lines.filter(
              (line) =>
                line.trim().match(/^[\d*\-•]+\s/) ||
                line.trim().match(/^[A-Z][\d\.\)\:]/) ||
                (line.includes(":") && line.length < 100)
            );

            if (bulletPoints.length > 0) {
              setThoughtsData(bulletPoints.slice(0, 5));
            } else {
              setThoughtsData([
                "Análise adicional baseada nas suas capturas de tela",
              ]);
            }
          } else {
            setThoughtsData([
              "Análise adicional baseada nas suas capturas de tela",
            ]);
          }
        } else {
          // Fallback to code or default
          setNewCode(data.code || "// Nenhuma análise disponível");
          setDebugContent(data.content || "");
          setThoughtsData(
            data.thoughts || [
              "Análise adicional baseada nas suas capturas de tela",
            ]
          );
          setDebugAnalysis(null);
        }
        setTimeComplexityData(
          data.time_complexity || "N/A - Modo de análise adicional"
        );
        setSpaceComplexityData(
          data.space_complexity || "N/A - Modo de análise adicional"
        );

        setIsProcessing(false);
      }),

      window.electronAPI.onDebugStart(() => {
        setIsProcessing(true);
      }),
      window.electronAPI.onDebugError((error: string) => {
        showToast(
          "Falha no Processamento",
          "Houve um erro ao processar a análise adicional.",
          "error"
        );
        setIsProcessing(false);
        console.error("Processing error:", error);
      }),
    ];

    // Set up resize observer
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight;
        const contentWidth = contentRef.current.scrollWidth;
        if (tooltipVisible) {
          contentHeight += tooltipHeight;
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    updateDimensions();

    return () => {
      resizeObserver.disconnect();
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [queryClient, setIsProcessing]);

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setTooltipVisible(visible);
    setTooltipHeight(height);
  };

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index];

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      );

      if (response.success) {
        refetch();
      } else {
        console.error("Failed to delete extra screenshot:", response.error);
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error);
    }
  };

  // Detecta se é um problema de programação baseado na presença de complexidade de tempo/espaço
  const isProgrammingProblem =
    timeComplexityData &&
    spaceComplexityData &&
    !timeComplexityData.includes("N/A") &&
    !spaceComplexityData.includes("N/A");

  return (
    <div ref={contentRef} className="relative">
      <div className="space-y-3 px-4 py-3">
        {/* Renderizar a fila de capturas de tela condicionalmente */}
        <div className="bg-transparent w-fit">
          <div className="pb-3">
            <div className="space-y-3 w-fit">
              <ScreenshotQueue
                screenshots={screenshots}
                onDeleteScreenshot={handleDeleteExtraScreenshot}
                isLoading={isProcessing}
              />
            </div>
          </div>
        </div>

        {/* Barra de navegação de comandos com o tooltip */}
        <SolutionCommands
          screenshots={screenshots}
          onTooltipVisibilityChange={handleTooltipVisibilityChange}
          isProcessing={isProcessing}
          extraScreenshots={screenshots}
          credits={window.__CREDITS__}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />

        {/* Conteúdo Principal */}
        <div className="w-full text-sm text-black bg-black/60 rounded-md">
          <div className="rounded-lg overflow-hidden">
            <div className="px-4 py-3 space-y-4">
              {/* Seção de Pensamentos */}
              <ContentSection
                title="O Que Encontrei"
                content={
                  thoughtsData && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        {thoughtsData.map((thought, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                            <div>{thought}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
                isLoading={!thoughtsData}
              />

              {/* Renderizar código se estiver disponível */}
              {newCode &&
                newCode.trim() !==
                  "// Modo de análise adicional - veja a análise abaixo" && (
                  <div className="space-y-2">
                    <h2 className="text-[13px] font-medium text-white tracking-wide">
                      Código
                    </h2>
                    <SyntaxHighlighter
                      showLineNumbers
                      language={
                        currentLanguage === "golang" ? "go" : currentLanguage
                      }
                      style={dracula}
                      customStyle={{
                        maxWidth: "100%",
                        margin: 0,
                        padding: "1rem",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        backgroundColor: "rgba(22, 27, 34, 0.5)",
                      }}
                      wrapLongLines={true}
                    >
                      {newCode}
                    </SyntaxHighlighter>
                  </div>
                )}

              {/* Seção de Análise Adicional */}
              <div className="space-y-2">
                <h2 className="text-[13px] font-medium text-white tracking-wide">
                  Análise Detalhada
                </h2>
                {!debugAnalysis && !debugContent ? (
                  <div className="space-y-1.5">
                    <div className="mt-4 flex">
                      <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
                        Carregando análise adicional...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full bg-black/30 rounded-md p-4 text-[13px] leading-[1.4] text-gray-100 whitespace-pre-wrap overflow-auto max-h-[600px]">
                    {/* Processar o texto de análise por seções e linhas */}
                    {(() => {
                      // Primeiro identificar seções-chave com base em padrões comuns na saída
                      const sections = [];
                      let currentSection = { title: "", content: [] };

                      // Conteúdo a exibir (priorizar debug_analysis se disponível)
                      const contentToDisplay =
                        debugAnalysis || debugContent || "";

                      // Dividir por possíveis cabeçalhos de seção (### ou ##)
                      const mainSections = contentToDisplay.split(
                        /(?=^#{1,3}\s|^\*\*\*|^\s*[A-Z][\w\s]+\s*$)/m
                      );

                      // Filtrar seções vazias e processar cada uma
                      mainSections.filter(Boolean).forEach((sectionText) => {
                        // Primeira linha pode ser um cabeçalho
                        const lines = sectionText.split("\n");
                        let title = "";
                        let startLineIndex = 0;

                        // Verificar se a primeira linha é um cabeçalho
                        if (
                          lines[0] &&
                          (lines[0].startsWith("#") ||
                            lines[0].startsWith("**") ||
                            lines[0].match(/^[A-Z][\w\s]+$/) ||
                            lines[0].includes("Novos") ||
                            lines[0].includes("Melhorias") ||
                            lines[0].includes("Otimizações"))
                        ) {
                          title = lines[0].replace(/^#+\s*|\*\*/g, "");
                          startLineIndex = 1;
                        }

                        // Adicionar a seção
                        sections.push({
                          title,
                          content: lines.slice(startLineIndex).filter(Boolean),
                        });
                      });

                      // Renderizar as seções processadas
                      return sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="mb-6">
                          {section.title && (
                            <div className="font-bold text-white/90 text-[14px] mb-2 pb-1 border-b border-white/10">
                              {section.title}
                            </div>
                          )}
                          <div className="pl-1">
                            {section.content.map((line, lineIndex) => {
                              // Lidar com blocos de código - detectar blocos completos
                              if (line.trim().startsWith("```")) {
                                // Se encontrarmos o início de um bloco de código, coletar todas as linhas até o final
                                if (
                                  line.trim() === "```" ||
                                  line.trim().startsWith("```")
                                ) {
                                  // Encontrar o fim deste bloco de código
                                  const codeBlockEndIndex =
                                    section.content.findIndex(
                                      (l, i) =>
                                        i > lineIndex && l.trim() === "```"
                                    );

                                  if (codeBlockEndIndex > lineIndex) {
                                    // Extrair linguagem se especificada
                                    const langMatch = line
                                      .trim()
                                      .match(/```(\w+)/);
                                    const language = langMatch
                                      ? langMatch[1]
                                      : "";

                                    // Obter o conteúdo do código
                                    const codeContent = section.content
                                      .slice(lineIndex + 1, codeBlockEndIndex)
                                      .join("\n");

                                    // Avançar no loop
                                    lineIndex = codeBlockEndIndex;

                                    return (
                                      <div
                                        key={lineIndex}
                                        className="font-mono text-xs bg-black/50 p-3 my-2 rounded overflow-x-auto"
                                      >
                                        {codeContent}
                                      </div>
                                    );
                                  }
                                }
                              }

                              // Lidar com pontos de lista
                              if (
                                line.trim().match(/^[\-*•]\s/) ||
                                line.trim().match(/^\d+\.\s/)
                              ) {
                                return (
                                  <div
                                    key={lineIndex}
                                    className="flex items-start gap-2 my-1.5"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                                    <div className="flex-1">
                                      {line.replace(/^[\-*•]\s|^\d+\.\s/, "")}
                                    </div>
                                  </div>
                                );
                              }

                              // Lidar com código inline
                              if (line.includes("`")) {
                                const parts = line.split(/(`[^`]+`)/g);
                                return (
                                  <div key={lineIndex} className="my-1.5">
                                    {parts.map((part, partIndex) => {
                                      if (
                                        part.startsWith("`") &&
                                        part.endsWith("`")
                                      ) {
                                        return (
                                          <span
                                            key={partIndex}
                                            className="font-mono bg-black/30 px-1 py-0.5 rounded"
                                          >
                                            {part.slice(1, -1)}
                                          </span>
                                        );
                                      }
                                      return (
                                        <span key={partIndex}>{part}</span>
                                      );
                                    })}
                                  </div>
                                );
                              }

                              // Lidar com subtítulos
                              if (
                                line.trim().match(/^#+\s/) ||
                                (line.trim().match(/^[A-Z][\w\s]+:/) &&
                                  line.length < 60)
                              ) {
                                return (
                                  <div
                                    key={lineIndex}
                                    className="font-semibold text-white/80 mt-3 mb-1"
                                  >
                                    {line.replace(/^#+\s+/, "")}
                                  </div>
                                );
                              }

                              // Texto regular
                              return (
                                <div key={lineIndex} className="my-1.5">
                                  {line}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Seção de Complexidade - exibida apenas para problemas de programação */}
              {isProgrammingProblem && (
                <ComplexitySection
                  timeComplexity={timeComplexityData}
                  spaceComplexity={spaceComplexityData}
                  isLoading={!timeComplexityData || !spaceComplexityData}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Debug;
