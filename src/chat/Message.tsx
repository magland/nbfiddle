/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Paper, Typography, IconButton, Button } from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import { FunctionComponent, PropsWithChildren, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import remarkGfm from "remark-gfm";
import { vs as highlightStyle } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ORMessage } from "../pages/HomePage/openRouterTypes";

type MessageContainerProps = {
  isUser: boolean;
  onRewind?: () => void;
};

const MessageContainer: FunctionComponent<
  PropsWithChildren<MessageContainerProps>
> = ({ children, isUser, onRewind }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={(theme) => ({
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: theme.spacing(1),
        padding: theme.spacing(0, 2),
      })}
    >
      {onRewind && isHovered && (
        <IconButton size="small" onClick={onRewind}>
          <UndoIcon sx={{ color: "text.secondary", fontSize: 14, mt: 1 }} />
          &nbsp;
        </IconButton>
      )}
      {children}
    </Box>
  );
};

type MessageBubbleProps = {
  isUser: boolean;
  message: ORMessage;
};

const MessageBubble: FunctionComponent<
  PropsWithChildren<MessageBubbleProps>
> = ({ children, isUser, message }) => {
  return (
    <Paper
      elevation={1}
      sx={(theme) => {
        const getBackgroundColor = () => {
          if (isUser) return theme.palette.primary.main;
          if (message.role === "tool")
            return `${theme.palette.success.light}20`; // Light green with 20% opacity
          if (message.role === "assistant" && "tool_calls" in message)
            return `${theme.palette.info.light}20`; // Light blue with 20% opacity
          return theme.palette.background.paper;
        };

        return {
          padding: theme.spacing(1, 2),
          maxWidth: "70%",
          backgroundColor: getBackgroundColor(),
          color: isUser
            ? theme.palette.primary.contrastText
            : theme.palette.text.primary,
          borderRadius: theme.spacing(2),
          wordBreak: "break-word",
        };
      }}
    >
      {children}
    </Paper>
  );
};

type MessageProps = {
  message: ORMessage;
  messages: ORMessage[];
  isUser: boolean;
  onDeleteMessage?: () => void;
};

const Message: FunctionComponent<MessageProps> = ({
  message,
  messages,
  isUser,
  onDeleteMessage,
}) => {
  const findToolName = (toolCallId: string): string => {
    for (const msg of messages) {
      if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls) {
        const toolCall = msg.tool_calls.find((tc) => tc.id === toolCallId);
        if (toolCall) {
          return toolCall.function.name;
        }
      }
    }
    return "unknown tool";
  };
  const [toolCallsExpanded, setToolCallsExpanded] = useState(false);
  const [toolResultExpanded, setToolResultExpanded] = useState(false);

  const renderContent = () => {
    // Handle tool calls (assistant requesting to use a tool)
    if (
      message.role === "assistant" &&
      "tool_calls" in message &&
      message.tool_calls
    ) {
      return (
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Box sx={{ mr: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {message.tool_calls.length === 1
                  ? "Tool Call: "
                  : "Tool Calls: "}
                {message.tool_calls.map((tc) => tc.function.name).join(", ")}
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={() => setToolCallsExpanded(!toolCallsExpanded)}
              sx={{ minWidth: "auto", py: 0 }}
            >
              {toolCallsExpanded ? "Hide" : "Show"}
            </Button>
          </Box>
          {toolCallsExpanded &&
            message.tool_calls.map((toolCall) => (
              <Box key={toolCall.id} sx={{ mb: 1 }}>
                {toolCall.function.name === "execute_python_code" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ children }) {
                        return (
                          <SyntaxHighlighter
                            PreTag="div"
                            children={String(children).replace(/\n$/, "")}
                            language="python"
                            style={highlightStyle}
                          />
                        );
                      },
                    }}
                  >
                    {`\`\`\`python\n${JSON.parse(toolCall.function.arguments).code}\n\`\`\``}
                  </ReactMarkdown>
                ) : (
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ fontFamily: "monospace" }}
                  >
                    `${toolCall.function.name}(${toolCall.function.arguments})`
                  </Typography>
                )}
              </Box>
            ))}
        </Box>
      );
    }

    // Handle tool results
    if (message.role === "tool" && "tool_call_id" in message) {
      return (
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Box sx={{ mr: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Tool Result: {findToolName(message.tool_call_id)}
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={() => setToolResultExpanded(!toolResultExpanded)}
              sx={{ minWidth: "auto", py: 0 }}
            >
              {toolResultExpanded ? "Hide" : "Show"}
            </Button>
          </Box>
          {toolResultExpanded && (
            <Box>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ children, ...props }) {
                    return (
                      <a
                        href={props.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                  code(props) {
                    const { children, className, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || "");
                    return match ? (
                      <SyntaxHighlighter
                        PreTag="div"
                        children={String(children).replace(/\n$/, "")}
                        language={match[1]}
                        style={highlightStyle}
                      />
                    ) : (
                      <code
                        {...rest}
                        className={className}
                        style={{ background: "#eee" }}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {formatMessageContent(message.content)}
              </ReactMarkdown>
            </Box>
          )}
        </Box>
      );
    }

    // Handle regular text content
    if (typeof message.content === "string") {
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a({ children, ...props }) {
              return (
                <a
                  href={props.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                >
                  {children}
                </a>
              );
            },
            code(props) {
              const { children, className, ...rest } = props;
              const match = /language-(\w+)/.exec(className || "");
              return match ? (
                <SyntaxHighlighter
                  PreTag="div"
                  children={String(children).replace(/\n$/, "")}
                  language={match[1]}
                  style={highlightStyle}
                />
              ) : (
                <code
                  {...rest}
                  className={className}
                  style={{ background: "#eee" }}
                >
                  {children}
                </code>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      );
    }

    // Handle array of content parts (e.g. text + images)
    if (Array.isArray(message.content)) {
      return message.content.map((part, index) => {
        if (part.type === "text") {
          return (
            <ReactMarkdown
              key={index}
              remarkPlugins={[remarkGfm]}
              components={{
                a({ children, ...props }) {
                  return (
                    <a
                      href={props.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
                code(props) {
                  const { children, className, ...rest } = props;
                  const match = /language-(\w+)/.exec(className || "");
                  return match ? (
                    <SyntaxHighlighter
                      PreTag="div"
                      children={String(children).replace(/\n$/, "")}
                      language={match[1]}
                      style={highlightStyle}
                    />
                  ) : (
                    <code
                      {...rest}
                      className={className}
                      style={{ background: "#eee" }}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {part.text}
            </ReactMarkdown>
          );
        }
        if (part.type === "image_url") {
          return (
            <Box key={index} sx={{ mt: 1 }}>
              <img
                src={part.image_url.url}
                alt="Content"
                style={{ borderRadius: 4 }}
              />
            </Box>
          );
        }
        return null;
      });
    }

    return null;
  };

  return (
    <MessageContainer isUser={isUser} onRewind={onDeleteMessage}>
      <MessageBubble isUser={isUser} message={message}>
        {renderContent()}
      </MessageBubble>
    </MessageContainer>
  );
};

const formatMessageContent = (x: any): string => {
  try {
    const content = JSON.parse(x);
    if (!content) return content;
    if (typeof content === "object") {
      if (content.result) return content.result;
    }
  } catch {
    return x;
  }
  return x;
};

export default Message;
