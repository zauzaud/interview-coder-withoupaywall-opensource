import fs from "node:fs";
import path from "node:path";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { IProcessingHelperDeps } from "./main";
import * as axios from "axios";
import { app, BrowserWindow, dialog } from "electron";
import { OpenAI } from "openai";
import { configHelper } from "./ConfigHelper";
import Anthropic from "@anthropic-ai/sdk";

// Interface for Gemini API requests
interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}
interface AnthropicMessage {
  role: "user" | "assistant";
  content: Array<{
    type: "text" | "image";
    text?: string;
    source?: {
      type: "base64";
      media_type: string;
      data: string;
    };
  }>;
}
export class ProcessingHelper {
  private deps: IProcessingHelperDeps;
  private screenshotHelper: ScreenshotHelper;
  private openaiClient: OpenAI | null = null;
  private geminiApiKey: string | null = null;
  private anthropicClient: Anthropic | null = null;

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null;
  private currentExtraProcessingAbortController: AbortController | null = null;

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps;
    this.screenshotHelper = deps.getScreenshotHelper();

    // Initialize AI client based on config
    this.initializeAIClient();

    // Listen for config changes to re-initialize the AI client
    configHelper.on("config-updated", () => {
      this.initializeAIClient();
    });
  }

  /**
   * Initialize or reinitialize the AI client with current config
   */
  private initializeAIClient(): void {
    try {
      const config = configHelper.loadConfig();

      if (config.apiProvider === "openai") {
        if (config.apiKey) {
          this.openaiClient = new OpenAI({
            apiKey: config.apiKey,
            timeout: 60000, // 60 second timeout
            maxRetries: 2, // Retry up to 2 times
          });
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.log("OpenAI client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn("No API key available, OpenAI client not initialized");
        }
      } else if (config.apiProvider === "gemini") {
        // Gemini client initialization
        this.openaiClient = null;
        this.anthropicClient = null;
        if (config.apiKey) {
          this.geminiApiKey = config.apiKey;
          console.log("Gemini API key set successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn("No API key available, Gemini client not initialized");
        }
      } else if (config.apiProvider === "anthropic") {
        // Reset other clients
        this.openaiClient = null;
        this.geminiApiKey = null;
        if (config.apiKey) {
          this.anthropicClient = new Anthropic({
            apiKey: config.apiKey,
            timeout: 60000,
            maxRetries: 2,
          });
          console.log("Anthropic client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn(
            "No API key available, Anthropic client not initialized"
          );
        }
      }
    } catch (error) {
      console.error("Failed to initialize AI client:", error);
      this.openaiClient = null;
      this.geminiApiKey = null;
      this.anthropicClient = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      );
      if (isInitialized) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("App failed to initialize after 5 seconds");
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return 999; // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow);
      return 999; // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error);
      return 999; // Unlimited credits as fallback
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }

      // Fallback to window variable if config doesn't have language
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow);
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          );

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }

      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error);
      return "python";
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    const config = configHelper.loadConfig();

    // First verify we have a valid AI client
    if (config.apiProvider === "openai" && !this.openaiClient) {
      this.initializeAIClient();

      if (!this.openaiClient) {
        console.error("OpenAI client not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    } else if (config.apiProvider === "gemini" && !this.geminiApiKey) {
      this.initializeAIClient();

      if (!this.geminiApiKey) {
        console.error("Gemini API key not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    } else if (config.apiProvider === "anthropic" && !this.anthropicClient) {
      // Add check for Anthropic client
      this.initializeAIClient();

      if (!this.anthropicClient) {
        console.error("Anthropic client not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    }

    const view = this.deps.getView();
    console.log("Processing screenshots in view:", view);

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START);
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue();
      console.log("Processing main queue screenshots:", screenshotQueue);

      // Check if the queue is empty
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // Check that files actually exist
      const existingScreenshots = screenshotQueue.filter((path) =>
        fs.existsSync(path)
      );
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController();
        const { signal } = this.currentProcessingAbortController;

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString("base64"),
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        );

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(
          validScreenshots,
          signal
        );

        if (!result.success) {
          console.log("Processing failed:", result.error);
          if (
            result.error?.includes("API Key") ||
            result.error?.includes("OpenAI") ||
            result.error?.includes("Gemini")
          ) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            );
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            );
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error");
          this.deps.setView("queue");
          return;
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        );
        this.deps.setView("solutions");
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        );
        console.error("Processing error:", error);
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          );
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error");
        this.deps.setView("queue");
      } finally {
        this.currentProcessingAbortController = null;
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue();
      console.log("Processing extra queue screenshots:", extraScreenshotQueue);

      // Check if the extra queue is empty
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);

        return;
      }

      // Check that files actually exist
      const existingExtraScreenshots = extraScreenshotQueue.filter((path) =>
        fs.existsSync(path)
      );
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START);

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController();
      const { signal } = this.currentExtraProcessingAbortController;

      try {
        // Get all screenshots (both main and extra) for processing
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots,
        ];

        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(`Screenshot file does not exist: ${path}`);
                return null;
              }

              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString("base64"),
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        );

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }

        console.log(
          "Combined screenshots for processing:",
          validScreenshots.map((s) => s.path)
        );

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots,
          signal
        );

        if (result.success) {
          this.deps.setHasDebugged(true);
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          );
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          );
        }
      } finally {
        this.currentExtraProcessingAbortController = null;
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();

      // Step 1: Extract information using AI Vision API (OpenAI or Gemini)
      const imageDataList = screenshots.map((screenshot) => screenshot.data);

      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analisando conteúdo das capturas de tela...",
          progress: 20,
        });
      }

      let contentInfo;

      if (config.apiProvider === "openai") {
        // Verify OpenAI client
        if (!this.openaiClient) {
          this.initializeAIClient(); // Try to reinitialize

          if (!this.openaiClient) {
            return {
              success: false,
              error:
                "Chave da API OpenAI não configurada ou inválida. Por favor, verifique suas configurações.",
            };
          }
        }

        // NOVO PROMPT GENÉRICO EM PORTUGUÊS PARA OPENAI
        const messages = [
          {
            role: "system" as const,
            content:
              "Você é um assistente inteligente que pode analisar qualquer conteúdo a partir de capturas de tela. Analise o que você vê e forneça uma resposta abrangente em português brasileiro. Você pode lidar com qualquer tipo de conteúdo - perguntas, problemas, textos, imagens, diagramas, etc. Sempre responda em português brasileiro.",
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: `Analise essas capturas de tela e forneça uma resposta detalhada em português do Brasil. Se for uma pergunta, responda-a. Se for um problema, resolva-o. Se for um texto que precisa de análise, analise-o. Seja detalhado em sua resposta. Se você detectar código ou um problema de programação, use ${language} como linguagem preferida. IMPORTANTE: Responda SEMPRE em português do Brasil.`,
              },
              ...imageDataList.map((data) => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` },
              })),
            ],
          },
        ];

        // Send to OpenAI Vision API
        const extractionResponse =
          await this.openaiClient.chat.completions.create({
            model: config.extractionModel || "gpt-4o",
            messages: messages,
            max_tokens: 4000,
            temperature: 0.2,
          });

        // Parse the response
        try {
          const responseText = extractionResponse.choices[0].message.content;
          // Simplified content processing
          contentInfo = {
            content_type: "generic", // Could be code_problem, question, text, etc.
            content: responseText,
            language: language,
          };
        } catch (error) {
          console.error("Error parsing OpenAI response:", error);
          return {
            success: false,
            error:
              "Falha ao analisar as informações. Por favor, tente novamente ou use capturas de tela mais claras.",
          };
        }
      } else if (config.apiProvider === "gemini") {
        // Use Gemini API
        if (!this.geminiApiKey) {
          return {
            success: false,
            error:
              "Chave da API Gemini não configurada. Por favor, verifique suas configurações.",
          };
        }

        try {
          // NOVO PROMPT GENÉRICO EM PORTUGUÊS PARA GEMINI
          const geminiMessages: GeminiMessage[] = [
            {
              role: "user",
              parts: [
                {
                  text: `Você é um assistente inteligente que pode analisar qualquer conteúdo a partir de capturas de tela. Analise o que você vê e forneça uma resposta abrangente em português brasileiro. Se for uma pergunta, responda-a. Se for um problema, resolva-o. Se for um texto que precisa de análise, analise-o. Se for código ou problema de programação, use ${language} como linguagem preferida. IMPORTANTE: Responda SEMPRE em português do Brasil, independente do idioma nas imagens.`,
                },
                ...imageDataList.map((data) => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data,
                  },
                })),
              ],
            },
          ];

          // Make API request to Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${
              config.extractionModel || "gemini-2.0-flash"
            }:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000,
              },
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;

          if (
            !responseData.candidates ||
            responseData.candidates.length === 0
          ) {
            throw new Error("Resposta vazia da API Gemini");
          }

          const responseText = responseData.candidates[0].content.parts[0].text;

          // Simplified content processing
          contentInfo = {
            content_type: "generic",
            content: responseText,
            language: language,
          };
        } catch (error) {
          console.error("Error using Gemini API:", error);
          return {
            success: false,
            error:
              "Falha ao processar com a API Gemini. Por favor, verifique sua chave de API ou tente novamente mais tarde.",
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error:
              "Chave da API Anthropic não configurada. Por favor, verifique suas configurações.",
          };
        }

        try {
          // NOVO PROMPT GENÉRICO EM PORTUGUÊS PARA ANTHROPIC
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `Você é um assistente inteligente que pode analisar qualquer conteúdo a partir de capturas de tela. Analise o que você vê e forneça uma resposta abrangente em português brasileiro. Se for uma pergunta, responda-a. Se for um problema, resolva-o. Se for um texto que precisa de análise, analise-o. Se for código ou problema de programação, use ${language} como linguagem preferida. IMPORTANTE: Responda SEMPRE em português do Brasil, independente do idioma nas imagens.`,
                },
                ...imageDataList.map((data) => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const,
                    data: data,
                  },
                })),
              ],
            },
          ];

          const response = await this.anthropicClient.messages.create({
            model: config.extractionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2,
          });

          const responseText = (
            response.content[0] as { type: "text"; text: string }
          ).text;

          // Simplified content processing
          contentInfo = {
            content_type: "generic",
            content: responseText,
            language: language,
          };
        } catch (error: any) {
          console.error("Error using Anthropic API:", error);

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error:
                "Limite de taxa da API Claude excedido. Por favor, aguarde alguns minutos antes de tentar novamente.",
            };
          } else if (
            error.status === 413 ||
            (error.message && error.message.includes("token"))
          ) {
            return {
              success: false,
              error:
                "Suas capturas de tela contêm muita informação para o Claude processar. Mude para OpenAI ou Gemini nas configurações, que podem lidar com entradas maiores.",
            };
          }

          return {
            success: false,
            error:
              "Falha ao processar com a API Anthropic. Por favor, verifique sua chave de API ou tente novamente mais tarde.",
          };
        }
      }

      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message:
            "Conteúdo analisado com sucesso. Preparando para gerar resposta...",
          progress: 40,
        });
      }

      // Store content info in AppState
      this.deps.setProblemInfo(contentInfo);

      // Send first success event
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          contentInfo
        );

        // Generate response after successful extraction
        const analysisResult = await this.generateAnalysisHelper(signal);
        if (analysisResult.success) {
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue();

          // Final progress update
          mainWindow.webContents.send("processing-status", {
            message: "Análise gerada com sucesso",
            progress: 100,
          });

          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            analysisResult.data
          );
          return { success: true, data: analysisResult.data };
        } else {
          throw new Error(analysisResult.error || "Falha ao gerar análise");
        }
      }

      return { success: false, error: "Falha ao processar capturas de tela" };
    } catch (error: any) {
      // If the request was cancelled, don't retry
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "O processamento foi cancelado pelo usuário.",
        };
      }

      // Handle OpenAI API errors specifically
      if (error?.response?.status === 401) {
        return {
          success: false,
          error:
            "Chave de API inválida. Por favor, verifique suas configurações.",
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error:
            "Limite de taxa da API excedido ou créditos insuficientes. Por favor, tente novamente mais tarde.",
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error:
            "Erro no servidor da API. Por favor, tente novamente mais tarde.",
        };
      }

      console.error("API Error Details:", error);
      return {
        success: false,
        error:
          error.message ||
          "Falha ao processar capturas de tela. Por favor, tente novamente.",
      };
    }
  }

  private async generateAnalysisHelper(signal: AbortSignal) {
    try {
      const contentInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!contentInfo) {
        throw new Error("Nenhuma informação de conteúdo disponível");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Criando análise detalhada com explicações...",
          progress: 60,
        });
      }

      // NOVO PROMPT GENÉRICO PARA ANÁLISE EM PORTUGUÊS
      const promptText = `
Analise e responda ao seguinte conteúdo detectado nas capturas de tela:

CONTEÚDO:
${contentInfo.content}

Se isso for um problema de programação ou contiver código, por favor use ${language} como linguagem preferida.

Forneça uma resposta abrangente em português do Brasil que aborde o que você vê. Sua resposta deve ser:
1. Completa e detalhada
2. Bem estruturada com seções claras
3. Incluir soluções de código, se apropriado
4. Incluir explicações do seu raciocínio
5. Incluir qualquer análise relevante

Se for um problema de programação, inclua também:
- Análise de complexidade de tempo e espaço, se aplicável
- Principais insights sobre o algoritmo ou abordagem
- Explicação passo a passo da solução

IMPORTANTE: Responda SEMPRE em português do Brasil.
`;

      let responseContent;

      if (config.apiProvider === "openai") {
        // OpenAI processing
        if (!this.openaiClient) {
          return {
            success: false,
            error:
              "Chave da API OpenAI não configurada. Por favor, verifique suas configurações.",
          };
        }

        // Send to OpenAI API
        const analysisResponse =
          await this.openaiClient.chat.completions.create({
            model: config.solutionModel || "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "Você é um assistente especialista que fornece análises detalhadas e soluções em português do Brasil.",
              },
              { role: "user", content: promptText },
            ],
            max_tokens: 4000,
            temperature: 0.2,
          });

        responseContent = analysisResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini") {
        // Gemini processing
        if (!this.geminiApiKey) {
          return {
            success: false,
            error:
              "Chave da API Gemini não configurada. Por favor, verifique suas configurações.",
          };
        }

        try {
          // Create Gemini message structure
          const geminiMessages = [
            {
              role: "user",
              parts: [
                {
                  text: `Você é um assistente especialista que fornece análises detalhadas e soluções em português do Brasil. ${promptText}`,
                },
              ],
            },
          ];

          // Make API request to Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${
              config.solutionModel || "gemini-2.0-flash"
            }:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000,
              },
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;

          if (
            !responseData.candidates ||
            responseData.candidates.length === 0
          ) {
            throw new Error("Resposta vazia da API Gemini");
          }

          responseContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error("Error using Gemini API for analysis:", error);
          return {
            success: false,
            error:
              "Falha ao gerar análise com a API Gemini. Por favor, verifique sua chave de API ou tente novamente mais tarde.",
          };
        }
      } else if (config.apiProvider === "anthropic") {
        // Anthropic processing
        if (!this.anthropicClient) {
          return {
            success: false,
            error:
              "Chave da API Anthropic não configurada. Por favor, verifique suas configurações.",
          };
        }

        try {
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `Você é um assistente especialista que fornece análises detalhadas e soluções em português do Brasil. ${promptText}`,
                },
              ],
            },
          ];

          // Send to Anthropic API
          const response = await this.anthropicClient.messages.create({
            model: config.solutionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2,
          });

          responseContent = (
            response.content[0] as { type: "text"; text: string }
          ).text;
        } catch (error: any) {
          console.error("Error using Anthropic API for analysis:", error);

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error:
                "Limite de taxa da API Claude excedido. Por favor, aguarde alguns minutos antes de tentar novamente.",
            };
          } else if (
            error.status === 413 ||
            (error.message && error.message.includes("token"))
          ) {
            return {
              success: false,
              error:
                "O conteúdo contém muita informação para o Claude processar. Mude para OpenAI ou Gemini nas configurações.",
            };
          }

          return {
            success: false,
            error:
              "Falha ao gerar análise com a API Anthropic. Por favor, verifique sua chave de API ou tente novamente mais tarde.",
          };
        }
      }

      // Extract parts from the response
      const codeMatch = responseContent.match(/```(?:\w+)?\s*([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : "";

      // Extract thoughts, looking for bullet points or numbered lists
      const thoughtsRegex =
        /(?:Pensamentos:|Insights:|Raciocínio:|Abordagem:|Análise:)([\s\S]*?)(?:Complexidade de tempo:|Código:|$)/i;
      const thoughtsMatch = responseContent.match(thoughtsRegex);
      let thoughts: string[] = [];

      if (thoughtsMatch && thoughtsMatch[1]) {
        // Extract bullet points or numbered items
        const bulletPoints = thoughtsMatch[1].match(
          /(?:^|\n)\s*(?:[-*•]|\d+\.)\s*(.*)/g
        );
        if (bulletPoints) {
          thoughts = bulletPoints
            .map((point) => point.replace(/^\s*(?:[-*•]|\d+\.)\s*/, "").trim())
            .filter(Boolean);
        } else {
          // If no bullet points found, split by newlines and filter empty lines
          thoughts = thoughtsMatch[1]
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        }
      }

      // Extract complexity information
      const timeComplexityPattern =
        /Complexidade de tempo:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Complexidade de espaço|$))/i;
      const spaceComplexityPattern =
        /Complexidade de espaço:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z]|$))/i;

      let timeComplexity = null;
      let spaceComplexity = null;

      const timeMatch = responseContent.match(timeComplexityPattern);
      if (timeMatch && timeMatch[1]) {
        timeComplexity = timeMatch[1].trim();
        if (!timeComplexity.match(/O\([^)]+\)/i)) {
          timeComplexity = `O(n) - ${timeComplexity}`;
        } else if (
          !timeComplexity.includes("-") &&
          !timeComplexity.includes("porque")
        ) {
          const notationMatch = timeComplexity.match(/O\([^)]+\)/i);
          if (notationMatch) {
            const notation = notationMatch[0];
            const rest = timeComplexity.replace(notation, "").trim();
            timeComplexity = `${notation} - ${rest}`;
          }
        }
      }

      const spaceMatch = responseContent.match(spaceComplexityPattern);
      if (spaceMatch && spaceMatch[1]) {
        spaceComplexity = spaceMatch[1].trim();
        if (!spaceComplexity.match(/O\([^)]+\)/i)) {
          spaceComplexity = `O(n) - ${spaceComplexity}`;
        } else if (
          !spaceComplexity.includes("-") &&
          !spaceComplexity.includes("porque")
        ) {
          const notationMatch = spaceComplexity.match(/O\([^)]+\)/i);
          if (notationMatch) {
            const notation = notationMatch[0];
            const rest = spaceComplexity.replace(notation, "").trim();
            spaceComplexity = `${notation} - ${rest}`;
          }
        }
      }

      const formattedResponse = {
        code: code || "", // Garantir string vazia em vez de null
        content: responseContent,
        thoughts:
          thoughts.length > 0
            ? thoughts
            : ["Análise baseada nas suas capturas de tela"],
        time_complexity:
          timeComplexity || "N/A - Não se aplica a este tipo de conteúdo",
        space_complexity:
          spaceComplexity || "N/A - Não se aplica a este tipo de conteúdo",
      };

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "O processamento foi cancelado pelo usuário.",
        };
      }

      if (error?.response?.status === 401) {
        return {
          success: false,
          error:
            "Chave de API inválida. Por favor, verifique suas configurações.",
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error:
            "Limite de taxa da API excedido ou créditos insuficientes. Por favor, tente novamente mais tarde.",
        };
      }

      console.error("Analysis generation error:", error);
      return {
        success: false,
        error: error.message || "Falha ao gerar análise",
      };
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const contentInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!contentInfo) {
        throw new Error("Nenhuma informação de conteúdo disponível");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processando capturas de tela adicionais...",
          progress: 30,
        });
      }

      // Prepare the images for the API call
      const imageDataList = screenshots.map((screenshot) => screenshot.data);

      let debugContent;

      if (config.apiProvider === "openai") {
        if (!this.openaiClient) {
          return {
            success: false,
            error:
              "Chave da API OpenAI não configurada. Por favor, verifique suas configurações.",
          };
        }

        // NOVO PROMPT GENÉRICO PARA ANÁLISE ADICIONAL EM PORTUGUÊS
        const messages = [
          {
            role: "system" as const,
            content: `Você é um assistente que analisa capturas de tela adicionais para fornecer mais informações ou correções à sua análise anterior. Você sempre responde em português brasileiro.

Sua resposta DEVE seguir esta estrutura exata com estes cabeçalhos de seção (use ### para cabeçalhos):
### Novos Elementos Identificados
- Liste cada novo elemento como um item de lista com explicação clara

### Melhorias e Correções Específicas
- Liste mudanças específicas necessárias como itens de lista

### Explicação das Alterações
Aqui forneça uma explicação clara de por que as mudanças são necessárias

### Pontos-Chave
- Resumo em tópicos das conclusões mais importantes

Se você incluir exemplos de código, use blocos de código markdown com especificação de linguagem (por exemplo, \`\`\`python).`,
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: `Estou analisando este conteúdo: "${contentInfo.content}". Agora estou mostrando capturas de tela adicionais. Use-as para:
1. Fornecer informações adicionais
2. Corrigir quaisquer mal-entendidos
3. Responder perguntas complementares
4. Depurar qualquer código ou soluções discutidas anteriormente
5. Adicionar mais detalhes à sua análise

IMPORTANTE: Responda SEMPRE em português do Brasil.`,
              },
              ...imageDataList.map((data) => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` },
              })),
            ],
          },
        ];

        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Analisando código e gerando feedback adicional...",
            progress: 60,
          });
        }

        const debugResponse = await this.openaiClient.chat.completions.create({
          model: config.debuggingModel || "gpt-4o",
          messages: messages,
          max_tokens: 4000,
          temperature: 0.2,
        });

        debugContent = debugResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini") {
        if (!this.geminiApiKey) {
          return {
            success: false,
            error:
              "Chave da API Gemini não configurada. Por favor, verifique suas configurações.",
          };
        }

        try {
          // NOVO PROMPT GENÉRICO PARA ANÁLISE ADICIONAL EM PORTUGUÊS PARA GEMINI
          const debugPrompt = `
Você é um assistente que analisa capturas de tela adicionais para fornecer mais informações ou correções à sua análise anterior. Você sempre responde em português brasileiro.

Estou analisando este conteúdo: "${contentInfo.content}". Agora estou mostrando capturas de tela adicionais. Use-as para:
1. Fornecer informações adicionais
2. Corrigir quaisquer mal-entendidos
3. Responder perguntas complementares
4. Depurar qualquer código ou soluções discutidas anteriormente
5. Adicionar mais detalhes à sua análise

SUA RESPOSTA DEVE SEGUIR ESTA ESTRUTURA EXATA COM ESTES CABEÇALHOS DE SEÇÃO:
### Novos Elementos Identificados
- Liste cada novo elemento como um item de lista com explicação clara

### Melhorias e Correções Específicas
- Liste mudanças específicas necessárias como itens de lista

### Explicação das Alterações
Aqui forneça uma explicação clara de por que as mudanças são necessárias

### Pontos-Chave
- Resumo em tópicos das conclusões mais importantes

Se você incluir exemplos de código, use blocos de código markdown com especificação de linguagem (por exemplo, \`\`\`python).

IMPORTANTE: Responda SEMPRE em português do Brasil.
`;

          const geminiMessages = [
            {
              role: "user",
              parts: [
                { text: debugPrompt },
                ...imageDataList.map((data) => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data,
                  },
                })),
              ],
            },
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message:
                "Analisando conteúdo e gerando feedback adicional com Gemini...",
              progress: 60,
            });
          }

          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${
              config.debuggingModel || "gemini-2.0-flash"
            }:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000,
              },
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;

          if (
            !responseData.candidates ||
            responseData.candidates.length === 0
          ) {
            throw new Error("Resposta vazia da API Gemini");
          }

          debugContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error("Error using Gemini API for debugging:", error);
          return {
            success: false,
            error:
              "Falha ao processar solicitação de análise adicional com a API Gemini. Por favor, verifique sua chave de API ou tente novamente mais tarde.",
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error:
              "Chave da API Anthropic não configurada. Por favor, verifique suas configurações.",
          };
        }

        try {
          // NOVO PROMPT GENÉRICO PARA ANÁLISE ADICIONAL EM PORTUGUÊS PARA ANTHROPIC
          const debugPrompt = `
Você é um assistente que analisa capturas de tela adicionais para fornecer mais informações ou correções à sua análise anterior. Você sempre responde em português brasileiro.

Estou analisando este conteúdo: "${contentInfo.content}". Agora estou mostrando capturas de tela adicionais. Use-as para:
1. Fornecer informações adicionais
2. Corrigir quaisquer mal-entendidos
3. Responder perguntas complementares
4. Depurar qualquer código ou soluções discutidas anteriormente
5. Adicionar mais detalhes à sua análise

SUA RESPOSTA DEVE SEGUIR ESTA ESTRUTURA EXATA COM ESTES CABEÇALHOS DE SEÇÃO:
### Novos Elementos Identificados
- Liste cada novo elemento como um item de lista com explicação clara

### Melhorias e Correções Específicas
- Liste mudanças específicas necessárias como itens de lista

### Explicação das Alterações
Aqui forneça uma explicação clara de por que as mudanças são necessárias

### Pontos-Chave
- Resumo em tópicos das conclusões mais importantes

Se você incluir exemplos de código, use blocos de código markdown com especificação de linguagem.

IMPORTANTE: Responda SEMPRE em português do Brasil.
`;

          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: debugPrompt,
                },
                ...imageDataList.map((data) => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const,
                    data: data,
                  },
                })),
              ],
            },
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message:
                "Analisando conteúdo e gerando feedback adicional com Claude...",
              progress: 60,
            });
          }

          const response = await this.anthropicClient.messages.create({
            model: config.debuggingModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2,
          });

          debugContent = (response.content[0] as { type: "text"; text: string })
            .text;
        } catch (error: any) {
          console.error("Error using Anthropic API for debugging:", error);

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error:
                "Limite de taxa da API Claude excedido. Por favor, aguarde alguns minutos antes de tentar novamente.",
            };
          } else if (
            error.status === 413 ||
            (error.message && error.message.includes("token"))
          ) {
            return {
              success: false,
              error:
                "Suas capturas de tela contêm muita informação para o Claude processar. Mude para OpenAI ou Gemini nas configurações que podem lidar com entradas maiores.",
            };
          }

          return {
            success: false,
            error:
              "Falha ao processar solicitação de análise adicional com a API Anthropic. Por favor, verifique sua chave de API ou tente novamente mais tarde.",
          };
        }
      }

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Análise adicional completa",
          progress: 100,
        });
      }

      let extractedCode = "// Modo de análise adicional - veja análise abaixo";
      const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
      }

      let formattedDebugContent = debugContent;

      if (!debugContent.includes("# ") && !debugContent.includes("## ")) {
        formattedDebugContent = debugContent
          .replace(
            /novos elementos|elementos identificados|problemas encontrados/i,
            "## Novos Elementos Identificados"
          )
          .replace(
            /melhorias|correções|mudanças sugeridas/i,
            "## Melhorias e Correções"
          )
          .replace(
            /explicação|análise detalhada/i,
            "## Explicação das Alterações"
          );
      }

      const bulletPoints = formattedDebugContent.match(
        /(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g
      );
      const thoughts = bulletPoints
        ? bulletPoints
            .map((point) =>
              point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, "").trim()
            )
            .slice(0, 5)
        : ["Análise adicional baseada nas suas capturas de tela"];

      const response = {
        code: extractedCode,
        content: formattedDebugContent,
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: "N/A - Modo de análise adicional",
        space_complexity: "N/A - Modo de análise adicional",
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error("Debug processing error:", error);
      return {
        success: false,
        error:
          error.message ||
          "Falha ao processar solicitação de análise adicional",
      };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false;

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      wasCancelled = true;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      wasCancelled = true;
    }

    this.deps.setHasDebugged(false);

    this.deps.setProblemInfo(null);

    const mainWindow = this.deps.getMainWindow();
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
    }
  }
}
