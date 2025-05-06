import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Settings } from "lucide-react";
import { useToast } from "../../contexts/toast";

type APIProvider = "openai" | "gemini" | "anthropic";

type AIModel = {
  id: string;
  name: string;
  description: string;
};

type ModelCategory = {
  key: "extractionModel" | "solutionModel" | "debuggingModel";
  title: string;
  description: string;
  openaiModels: AIModel[];
  geminiModels: AIModel[];
  anthropicModels: AIModel[];
};

// Define available models for each category
const modelCategories: ModelCategory[] = [
  {
    key: "extractionModel",
    title: "Extração de Problemas",
    description:
      "Modelo usado para analisar screenshots e extrair detalhes do problema",
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Melhor desempenho geral para extração de problemas",
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Opção mais rápida e econômica",
      },
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Melhor desempenho geral para extração de problemas",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Opção mais rápida e econômica",
      },
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Melhor desempenho geral para extração de problemas",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Desempenho equilibrado e velocidade",
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Inteligência de nível superior, fluência e compreensão",
      },
    ],
  },
  {
    key: "solutionModel",
    title: "Solution Generation",
    description: "Model used to generate coding solutions",
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Melhor desempenho geral para tarefas de codificação",
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Opção mais rápida e econômica",
      },
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Melhor desempenho geral para tarefas de codificação",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Opção mais rápida e econômica",
      },
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Melhor desempenho geral para tarefas de codificação",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Desempenho equilibrado e velocidade",
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Inteligência de nível superior, fluência e compreensão",
      },
    ],
  },
  {
    key: "debuggingModel",
    title: "Debug",
    description: "Modelo usado para depurar e melhorar soluções",
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Melhor para analisar código e mensagens de erro",
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Opção mais rápida e econômica",
      },
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Melhor para analisar código e mensagens de erro",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Opção mais rápida e econômica",
      },
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Melhor para analisar código e mensagens de erro",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Desempenho equilibrado e velocidade",
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Inteligência de nível superior, fluência e compreensão",
      },
    ],
  },
];

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({
  open: externalOpen,
  onOpenChange,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState("gpt-4o");
  const [solutionModel, setSolutionModel] = useState("gpt-4o");
  const [debuggingModel, setDebuggingModel] = useState("gpt-4o");
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Handle open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // Only call onOpenChange when there's actually a change
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };

  // Load current config on dialog open
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      interface Config {
        apiKey?: string;
        apiProvider?: APIProvider;
        extractionModel?: string;
        solutionModel?: string;
        debuggingModel?: string;
      }

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          setApiKey(config.apiKey || "");
          setApiProvider(config.apiProvider || "openai");
          setExtractionModel(config.extractionModel || "gpt-4o");
          setSolutionModel(config.solutionModel || "gpt-4o");
          setDebuggingModel(config.debuggingModel || "gpt-4o");
        })
        .catch((error: unknown) => {
          console.error("Failed to load config:", error);
          showToast("Error", "Failed to load settings", "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, showToast]);

  // Handle API provider change
  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);

    // Reset models to defaults when changing provider
    if (provider === "openai") {
      setExtractionModel("gpt-4o");
      setSolutionModel("gpt-4o");
      setDebuggingModel("gpt-4o");
    } else if (provider === "gemini") {
      setExtractionModel("gemini-1.5-pro");
      setSolutionModel("gemini-1.5-pro");
      setDebuggingModel("gemini-1.5-pro");
    } else if (provider === "anthropic") {
      setExtractionModel("claude-3-7-sonnet-20250219");
      setSolutionModel("claude-3-7-sonnet-20250219");
      setDebuggingModel("claude-3-7-sonnet-20250219");
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
      });

      if (result) {
        showToast("Sucesso", "Configurações salvas com sucesso", "success");
        handleOpenChange(false);

        // Force reload the app to apply the API key
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Erro", "Falha ao salvar configurações", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Open external link handler
  const openExternalLink = (url: string) => {
    window.electronAPI.openLink(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-black border border-white/10 text-white settings-dialog"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(450px, 90vw)",
          height: "auto",
          minHeight: "400px",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 9999,
          margin: 0,
          padding: "20px",
          transition: "opacity 0.25s ease, transform 0.25s ease",
          animation: "fadeIn 0.25s ease forwards",
          opacity: 0.98,
        }}
      >
        <DialogHeader>
          <DialogTitle>Configurações da API</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure sua chave API e preferências de modelo. Você precisará de
            sua própria chave API para usar este aplicativo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* API Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">
              Provedor de API
            </label>
            <div className="flex gap-2">
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "openai"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("openai")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "openai" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">OpenAI</p>
                    <p className="text-xs text-white/60">GPT-4o models</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "gemini"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("gemini")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "gemini" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Gemini</p>
                    <p className="text-xs text-white/60">Modelos Gemini 1.5</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "anthropic"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("anthropic")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "anthropic" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Claude</p>
                    <p className="text-xs text-white/60">Modelos Claude 3</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="apiKey">
              {apiProvider === "openai"
                ? "Chave API OpenAI"
                : apiProvider === "gemini"
                ? "Chave API Gemini"
                : "Chave API Anthropic"}
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                apiProvider === "openai"
                  ? "sk-..."
                  : apiProvider === "gemini"
                  ? "Enter your Gemini API key"
                  : "sk-ant-..."
              }
              className="bg-black/50 border-white/10 text-white"
            />
            {apiKey && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(apiKey)}
              </p>
            )}
            <p className="text-xs text-white/50">
              Sua chave API é armazenada localmente e nunca é enviada para
              nenhum servidor, exceto{" "}
              {apiProvider === "openai" ? "OpenAI" : "Google"}
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">
                Não tem uma chave API?
              </p>
              {apiProvider === "openai" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">
                    1. Crie uma conta no{" "}
                    <button
                      onClick={() =>
                        openExternalLink("https://platform.openai.com/signup")
                      }
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      OpenAI
                    </button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">
                    2. Vá para a{" "}
                    <button
                      onClick={() =>
                        openExternalLink("https://platform.openai.com/api-keys")
                      }
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      seção de chaves API
                    </button>
                  </p>
                  <p className="text-xs text-white/60">
                    3. Crie uma nova chave secreta e cole-a aqui
                  </p>
                </>
              ) : apiProvider === "gemini" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">
                    1. Crie uma conta no{" "}
                    <button
                      onClick={() =>
                        openExternalLink("https://aistudio.google.com/")
                      }
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      Google AI Studio
                    </button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">
                    2. Vá para a{" "}
                    <button
                      onClick={() =>
                        openExternalLink(
                          "https://aistudio.google.com/app/apikey"
                        )
                      }
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      seção de chaves API
                    </button>
                  </p>
                  <p className="text-xs text-white/60">
                    3. Crie uma nova chave API e cole-a aqui
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-white/60 mb-1">
                    1. Crie uma conta no{" "}
                    <button
                      onClick={() =>
                        openExternalLink("https://console.anthropic.com/signup")
                      }
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      Anthropic
                    </button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">
                    2. Vá para a{" "}
                    <button
                      onClick={() =>
                        openExternalLink(
                          "https://console.anthropic.com/settings/keys"
                        )
                      }
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      seção de chaves API
                    </button>
                  </p>
                  <p className="text-xs text-white/60">
                    3. Crie uma nova chave API e cole-a aqui
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">
              Atalhos de teclado
            </label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">Alternar Visibilidade</div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>

                <div className="text-white/70">Capturar Tela</div>
                <div className="text-white/90 font-mono">Ctrl+H / Cmd+H</div>

                <div className="text-white/70">Processar Capturas de Tela</div>
                <div className="text-white/90 font-mono">
                  Ctrl+Enter / Cmd+Enter
                </div>

                <div className="text-white/70">Deletar Última Captura</div>
                <div className="text-white/90 font-mono">Ctrl+L / Cmd+L</div>

                <div className="text-white/70">Reiniciar Visualização</div>
                <div className="text-white/90 font-mono">Ctrl+R / Cmd+R</div>

                <div className="text-white/70">Sair da Aplicação</div>
                <div className="text-white/90 font-mono">Ctrl+Q / Cmd+Q</div>

                <div className="text-white/70">Mover Janela</div>
                <div className="text-white/90 font-mono">Teclas de seta</div>

                <div className="text-white/70">Diminuir Opacidade</div>
                <div className="text-white/90 font-mono">Ctrl+[ / Cmd+[</div>

                <div className="text-white/70">Aumentar Opacidade</div>
                <div className="text-white/90 font-mono">Ctrl+] / Cmd+]</div>

                <div className="text-white/70">Diminuir Zoom</div>
                <div className="text-white/90 font-mono">Ctrl+- / Cmd+-</div>

                <div className="text-white/70">Reiniciar Zoom</div>
                <div className="text-white/90 font-mono">Ctrl+0 / Cmd+0</div>

                <div className="text-white/70">Aumentar Zoom</div>
                <div className="text-white/90 font-mono">Ctrl+= / Cmd+=</div>
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">
              Seleção de Modelo AI
            </label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              Selecione quais modelos usar para cada etapa do processo
            </p>

            {modelCategories.map((category) => {
              // Get the appropriate model list based on selected provider
              const models =
                apiProvider === "openai"
                  ? category.openaiModels
                  : apiProvider === "gemini"
                  ? category.geminiModels
                  : category.anthropicModels;

              return (
                <div key={category.key} className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {category.title}
                  </label>
                  <p className="text-xs text-white/60 mb-2">
                    {category.description}
                  </p>

                  <div className="space-y-2">
                    {models.map((m) => {
                      // Determine which state to use based on category key
                      const currentValue =
                        category.key === "extractionModel"
                          ? extractionModel
                          : category.key === "solutionModel"
                          ? solutionModel
                          : debuggingModel;

                      // Determine which setter function to use
                      const setValue =
                        category.key === "extractionModel"
                          ? setExtractionModel
                          : category.key === "solutionModel"
                          ? setSolutionModel
                          : setDebuggingModel;

                      return (
                        <div
                          key={m.id}
                          className={`p-2 rounded-lg cursor-pointer transition-colors ${
                            currentValue === m.id
                              ? "bg-white/10 border border-white/20"
                              : "bg-black/30 border border-white/5 hover:bg-white/5"
                          }`}
                          onClick={() => setValue(m.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                currentValue === m.id
                                  ? "bg-white"
                                  : "bg-white/20"
                              }`}
                            />
                            <div>
                              <p className="font-medium text-white text-xs">
                                {m.name}
                              </p>
                              <p className="text-xs text-white/60">
                                {m.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            Cancelar
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={isLoading || !apiKey}
          >
            {isLoading ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
