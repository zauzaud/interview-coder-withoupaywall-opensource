import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";

import ScreenshotQueue from "../components/Queue/ScreenshotQueue";

import { ProblemStatementData } from "../types/solutions";
import SolutionCommands from "../components/Solutions/SolutionCommands";
import Debug from "./Debug";
import { useToast } from "../contexts/toast";
import { COMMAND_KEY } from "../utils/platform";

interface SolutionData {
  code: string;
  content: string;
  thoughts: string[];
  time_complexity: string;
  space_complexity: string;
}

export const ContentSection = ({
  title,
  content,
  isLoading,
}: {
  title: string;
  content: React.ReactNode;
  isLoading: boolean;
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Analisando conteúdo...
        </p>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 max-w-[600px]">
        {content}
      </div>
    )}
  </div>
);

// Novo componente para renderizar qualquer conteúdo
const ContentRenderer = ({
  content,
  isLoading,
  currentLanguage,
}: {
  content: string;
  isLoading: boolean;
  currentLanguage: string;
}) => {
  const [copied, setCopied] = useState(false);

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

  const copyToClipboard = () => {
    if (typeof content === "string") {
      navigator.clipboard.writeText(content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="space-y-2 relative">
      {isLoading ? (
        <div className="space-y-1.5">
          <div className="mt-4 flex">
            <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
              Gerando análise...
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full relative">
          <button
            onClick={copyToClipboard}
            className="absolute top-2 right-2 text-xs text-white bg-white/10 hover:bg-white/20 rounded px-2 py-1 transition"
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>

          {/* Renderizar com ou sem blocos de código */}
          {hasCodeBlocks(content) ? (
            renderWithCodeBlocks(content)
          ) : (
            <div className="w-full bg-black/30 rounded-md p-4 text-[13px] leading-[1.4] text-gray-100 whitespace-pre-wrap">
              {content}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading,
}: {
  timeComplexity: string | null;
  spaceComplexity: string | null;
  isLoading: boolean;
}) => {
  // Helper to ensure we have proper complexity values
  const formatComplexity = (complexity: string | null): string => {
    // Default if no complexity returned by LLM
    if (!complexity || complexity.trim() === "") {
      return "Complexidade não disponível";
    }

    const bigORegex = /O\([^)]+\)/i;
    // Return the complexity as is if it already has Big O notation
    if (bigORegex.test(complexity)) {
      return complexity;
    }

    // Concat Big O notation to the complexity
    return `O(${complexity})`;
  };

  const formattedTimeComplexity = formatComplexity(timeComplexity);
  const formattedSpaceComplexity = formatComplexity(spaceComplexity);

  return (
    <div className="space-y-2">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        Complexidade
      </h2>
      {isLoading ? (
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Calculando complexidade...
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>Tempo:</strong> {formattedTimeComplexity}
              </div>
            </div>
          </div>
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>Espaço:</strong> {formattedSpaceComplexity}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export interface SolutionsProps {
  setView: (view: "queue" | "solutions" | "debug") => void;
  credits: number;
  currentLanguage: string;
  setLanguage: (language: string) => void;
}
const Solutions: React.FC<SolutionsProps> = ({
  setView,
  credits,
  currentLanguage,
  setLanguage,
}) => {
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  const [debugProcessing, setDebugProcessing] = useState(false);
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null);
  const [solutionData, setSolutionData] = useState<string>("");
  const [contentData, setContentData] = useState<string>("");
  const [thoughtsData, setThoughtsData] = useState<string[]>([
    "Análise baseada nas suas capturas de tela",
  ]);
  const [timeComplexityData, setTimeComplexityData] = useState<string>(
    "N/A - Não se aplica a este tipo de conteúdo"
  );
  const [spaceComplexityData, setSpaceComplexityData] = useState<string>(
    "N/A - Não se aplica a este tipo de conteúdo"
  );

  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(0);

  const [isResetting, setIsResetting] = useState(false);

  interface Screenshot {
    id: string;
    path: string;
    preview: string;
    timestamp: number;
  }

  const [extraScreenshots, setExtraScreenshots] = useState<Screenshot[]>([]);

  useEffect(() => {
    const fetchScreenshots = async () => {
      try {
        const existing = await window.electronAPI.getScreenshots();
        console.log("Raw screenshot data:", existing);
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now(),
          })
        );
        console.log("Processed screenshots:", screenshots);
        setExtraScreenshots(screenshots);
      } catch (error) {
        console.error("Error loading extra screenshots:", error);
        setExtraScreenshots([]);
      }
    };

    fetchScreenshots();
  }, [solutionData]);

  const { showToast } = useToast();

  useEffect(() => {
    // Height update logic
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight;
        const contentWidth = contentRef.current.scrollWidth;
        if (isTooltipVisible) {
          contentHeight += tooltipHeight;
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight,
        });
      }
    };

    // Initialize resize observer
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    updateDimensions();

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(async () => {
        try {
          const existing = await window.electronAPI.getScreenshots();
          const screenshots = (Array.isArray(existing) ? existing : []).map(
            (p) => ({
              id: p.path,
              path: p.path,
              preview: p.preview,
              timestamp: Date.now(),
            })
          );
          setExtraScreenshots(screenshots);
        } catch (error) {
          console.error("Error loading extra screenshots:", error);
        }
      }),
      window.electronAPI.onResetView(() => {
        // Set resetting state first
        setIsResetting(true);

        // Remove queries
        queryClient.removeQueries({
          queryKey: ["solution"],
        });
        queryClient.removeQueries({
          queryKey: ["new_solution"],
        });

        // Reset screenshots
        setExtraScreenshots([]);

        // After a small delay, clear the resetting state
        setTimeout(() => {
          setIsResetting(false);
        }, 0);
      }),
      window.electronAPI.onSolutionStart(() => {
        // Every time processing starts, reset relevant states
        setSolutionData("");
        setContentData("");
        setThoughtsData(["Análise baseada nas suas capturas de tela"]);
        setTimeComplexityData("N/A - Não se aplica a este tipo de conteúdo");
        setSpaceComplexityData("N/A - Não se aplica a este tipo de conteúdo");
      }),
      window.electronAPI.onProblemExtracted((data: any) => {
        queryClient.setQueryData(["problem_statement"], data);
      }),
      //if there was an error processing the initial solution
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Falha no Processamento", error, "error");
        // Reset solutions in the cache (even though this shouldn't ever happen) and complexities to previous states
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string;
          content: string;
          thoughts: string[];
          time_complexity: string;
          space_complexity: string;
        } | null;
        if (!solution) {
          setView("queue");
        }
        setSolutionData(solution?.code || "");
        setContentData(solution?.content || "");
        setThoughtsData(solution?.thoughts || []);
        setTimeComplexityData(solution?.time_complexity || "");
        setSpaceComplexityData(solution?.space_complexity || "");
        console.error("Processing error:", error);
      }),
      //when the initial solution is generated, we'll set the solution data to that
      window.electronAPI.onSolutionSuccess((data: any) => {
        if (!data) {
          console.warn("Received empty or invalid solution data");
          return;
        }
        console.log({ data });

        // Garantir que todos os campos existam
        const processedData = {
          code: data.code || "",
          content: data.content || "",
          thoughts: Array.isArray(data.thoughts)
            ? data.thoughts
            : ["Análise baseada nas suas capturas de tela"],
          time_complexity:
            data.time_complexity ||
            "N/A - Não se aplica a este tipo de conteúdo",
          space_complexity:
            data.space_complexity ||
            "N/A - Não se aplica a este tipo de conteúdo",
        };

        // Armazenar em cache
        queryClient.setQueryData(["solution"], processedData);

        // Atualizar estados
        setSolutionData(processedData.code);
        setContentData(processedData.content);
        setThoughtsData(processedData.thoughts);
        setTimeComplexityData(processedData.time_complexity);
        setSpaceComplexityData(processedData.space_complexity);

        // Fetch latest screenshots when solution is successful
        const fetchScreenshots = async () => {
          try {
            const existing = await window.electronAPI.getScreenshots();
            const screenshots =
              existing.previews?.map((p) => ({
                id: p.path,
                path: p.path,
                preview: p.preview,
                timestamp: Date.now(),
              })) || [];
            setExtraScreenshots(screenshots);
          } catch (error) {
            console.error("Error loading extra screenshots:", error);
            setExtraScreenshots([]);
          }
        };
        fetchScreenshots();
      }),

      //########################################################
      //DEBUG EVENTS
      //########################################################
      window.electronAPI.onDebugStart(() => {
        //we'll set the debug processing state to true and use that to render a little loader
        setDebugProcessing(true);
      }),
      //the first time debugging works, we'll set the view to debug and populate the cache with the data
      window.electronAPI.onDebugSuccess((data: any) => {
        queryClient.setQueryData(["new_solution"], data);
        setDebugProcessing(false);
      }),
      //when there was an error in the initial debugging, we'll show a toast and stop the little generating pulsing thing.
      window.electronAPI.onDebugError(() => {
        showToast(
          "Falha no Processamento",
          "Houve um erro ao realizar a análise adicional.",
          "error"
        );
        setDebugProcessing(false);
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "Sem Capturas de Tela",
          "Não há capturas de tela adicionais para processar.",
          "neutral"
        );
      }),
      // Removed out of credits handler - unlimited credits in this version
    ];

    return () => {
      resizeObserver.disconnect();
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [isTooltipVisible, tooltipHeight]);

  useEffect(() => {
    // Executar após a renderização para evitar erros de prefetch
    const timer = setTimeout(() => {
      const problemData =
        queryClient.getQueryData<ProblemStatementData>(["problem_statement"]) ||
        null;
      setProblemStatementData(problemData);

      const solution = queryClient.getQueryData<SolutionData>(["solution"]);
      if (solution) {
        setSolutionData(solution.code || "");
        setContentData(solution.content || "");
        setThoughtsData(
          solution.thoughts || ["Análise baseada nas suas capturas de tela"]
        );
        setTimeComplexityData(
          solution.time_complexity ||
            "N/A - Não se aplica a este tipo de conteúdo"
        );
        setSpaceComplexityData(
          solution.space_complexity ||
            "N/A - Não se aplica a este tipo de conteúdo"
        );
      }
    }, 0);

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        const problemData =
          queryClient.getQueryData<ProblemStatementData>([
            "problem_statement",
          ]) || null;
        setProblemStatementData(problemData);
      }
      if (event?.query.queryKey[0] === "solution") {
        const solution = queryClient.getQueryData<SolutionData>(["solution"]);
        if (solution) {
          setSolutionData(solution.code || "");
          setContentData(solution.content || "");
          setThoughtsData(
            solution.thoughts || ["Análise baseada nas suas capturas de tela"]
          );
          setTimeComplexityData(
            solution.time_complexity ||
              "N/A - Não se aplica a este tipo de conteúdo"
          );
          setSpaceComplexityData(
            solution.space_complexity ||
              "N/A - Não se aplica a este tipo de conteúdo"
          );
        }
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient]);

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible);
    setTooltipHeight(height);
  };

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index];

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      );

      if (response.success) {
        // Fetch and update screenshots after successful deletion
        const existing = await window.electronAPI.getScreenshots();
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now(),
          })
        );
        setExtraScreenshots(screenshots);
      } else {
        console.error("Failed to delete extra screenshot:", response.error);
        showToast("Erro", "Falha ao excluir a captura de tela", "error");
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error);
      showToast("Erro", "Falha ao excluir a captura de tela", "error");
    }
  };

  // Detecta se é um problema de programação baseado na presença de complexidade de tempo/espaço
  const isProgrammingProblem =
    timeComplexityData &&
    spaceComplexityData &&
    !timeComplexityData.includes("N/A") &&
    !spaceComplexityData.includes("N/A");

  return (
    <>
      {!isResetting && queryClient.getQueryData(["new_solution"]) ? (
        <Debug
          isProcessing={debugProcessing}
          setIsProcessing={setDebugProcessing}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : (
        <div ref={contentRef} className="relative">
          <div className="space-y-3 px-4 py-3">
            {/* Renderizar a fila de capturas de tela se houver dados de solução */}
            {solutionData && (
              <div className="bg-transparent w-fit">
                <div className="pb-3">
                  <div className="space-y-3 w-fit">
                    <ScreenshotQueue
                      isLoading={debugProcessing}
                      screenshots={extraScreenshots}
                      onDeleteScreenshot={handleDeleteExtraScreenshot}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Comandos com tooltip */}
            <SolutionCommands
              onTooltipVisibilityChange={handleTooltipVisibilityChange}
              isProcessing={!problemStatementData || !solutionData}
              extraScreenshots={extraScreenshots}
              credits={credits}
              currentLanguage={currentLanguage}
              setLanguage={setLanguage}
            />

            {/* Conteúdo principal */}
            <div className="w-full text-sm text-black bg-black/60 rounded-md">
              <div className="rounded-lg overflow-hidden">
                <div className="px-4 py-3 space-y-4 max-w-full">
                  {!contentData || contentData === "" ? (
                    <>
                      <ContentSection
                        title="Analisando"
                        content={
                          problemStatementData?.problem_statement ||
                          "Analisando conteúdo das capturas de tela..."
                        }
                        isLoading={!problemStatementData}
                      />
                      {problemStatementData && (
                        <div className="mt-4 flex">
                          <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
                            Gerando análise completa...
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <ContentSection
                        title="Pontos-Chave"
                        content={
                          <div className="space-y-3">
                            <div className="space-y-1">
                              {thoughtsData?.map((thought, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-2"
                                >
                                  <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                                  <div>{thought}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        }
                        isLoading={false}
                      />

                      {/* Renderizar solução ou conteúdo baseado no que está disponível */}
                      {solutionData && solutionData.trim() !== "" ? (
                        <div className="space-y-2">
                          <h2 className="text-[13px] font-medium text-white tracking-wide">
                            Código
                          </h2>
                          <SyntaxHighlighter
                            showLineNumbers
                            language={
                              currentLanguage === "golang"
                                ? "go"
                                : currentLanguage
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
                            {solutionData}
                          </SyntaxHighlighter>
                        </div>
                      ) : contentData ? (
                        <div className="space-y-2">
                          <h2 className="text-[13px] font-medium text-white tracking-wide">
                            Análise Completa
                          </h2>
                          <ContentRenderer
                            content={contentData}
                            isLoading={!contentData}
                            currentLanguage={currentLanguage}
                          />
                        </div>
                      ) : null}

                      {/* Mostrar análise de complexidade apenas para problemas de programação */}
                      {isProgrammingProblem && (
                        <ComplexitySection
                          timeComplexity={timeComplexityData}
                          spaceComplexity={spaceComplexityData}
                          isLoading={
                            !timeComplexityData || !spaceComplexityData
                          }
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Solutions;
