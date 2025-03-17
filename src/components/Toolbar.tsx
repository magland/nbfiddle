import CancelIcon from "@mui/icons-material/Cancel";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import GitHubIcon from "@mui/icons-material/GitHub";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Toolbar as MuiToolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { ImmutableNotebook } from "@nteract/commutable";
import { FunctionComponent, useState } from "react";
import { useJupyterConnectivity } from "../jupyter/JupyterConnectivity";
import PythonSessionClient from "../jupyter/PythonSessionClient";
import { ParsedUrlParams } from "../shared/util/indexedDb";
import CloudSaveDialog from "./CloudSaveDialog";

type ToolbarProps = {
  executingCellId: string | null;
  onRestartSession: () => void;
  sessionClient: PythonSessionClient | null;
  onCancel?: () => void;
  parsedUrlParams: ParsedUrlParams | null;
  hasLocalChanges?: boolean;
  onResetToRemote?: () => void;
  onDownload?: () => void;
  onUpdateGist: (token: string) => Promise<void>;
  onSaveGist: (token: string, fileName: string) => Promise<void>;
  notebook: ImmutableNotebook;
};

const Toolbar: FunctionComponent<ToolbarProps> = ({
  executingCellId,
  onRestartSession,
  sessionClient,
  onCancel,
  parsedUrlParams,
  hasLocalChanges,
  onResetToRemote,
  onDownload,
  onUpdateGist,
  onSaveGist,
  notebook,
}) => {
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [cloudSaveDialogOpen, setCloudSaveDialogOpen] = useState(false);

  const handleRestartSession = () => {
    setRestartDialogOpen(false);
    onRestartSession();
  };

  const handleResetToRemote = () => {
    setResetDialogOpen(false);
    onResetToRemote?.();
  };

  const { jupyterServerIsAvailable } = useJupyterConnectivity();

  const getConnectionStatus = () => {
    if (sessionClient) {
      return {
        color: "#4caf50",
      };
    }
    if (jupyterServerIsAvailable) {
      return {
        color: "#ff9800",
        text: "Starting session...",
      };
    }
    return {
      color: "#d32f2f",
      text: "No Jupyter server",
    };
  };

  const a = parsedUrlParams
    ? parsedUrlParams.type === "github"
      ? `${parsedUrlParams.owner}/${parsedUrlParams.repo}/${parsedUrlParams.path}`
      : parsedUrlParams.type === "gist"
        ? `${parsedUrlParams.owner}/${parsedUrlParams.gistId}/${parsedUrlParams.gistFileMorphed}`
        : "Invalid parsedUrlParams"
    : null;

  const status = getConnectionStatus();
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <MuiToolbar
        variant="dense"
        sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexGrow: 1,
            userSelect: "none",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: status.color,
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {status.text}
            </Typography>
          </Box>
          {executingCellId ? (
            <Tooltip title={`Executing cell`}>
              <CircularProgress size={20} color="primary" />
            </Tooltip>
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontFamily: "monospace" }}
            >
              Ready
            </Typography>
          )}

          {parsedUrlParams && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <GitHubIcon fontSize="small" />
              <Tooltip title={a}>
                <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                  {a}
                </Typography>
              </Tooltip>
              {hasLocalChanges && (
                <Typography
                  variant="body2"
                  color="warning.main"
                  sx={{ fontStyle: "italic" }}
                >
                  (Modified)
                </Typography>
              )}
              {hasLocalChanges && onResetToRemote && (
                <Tooltip
                  title={
                    parsedUrlParams.type === "github"
                      ? "Reset to GitHub version"
                      : parsedUrlParams.type === "gist"
                        ? "Reset to Gist version"
                        : "Invalid parsedUrlParams"
                  }
                >
                  <IconButton
                    size="small"
                    onClick={() => setResetDialogOpen(true)}
                  >
                    <RestartAltIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Save to cloud">
            <IconButton
              size="small"
              color="primary"
              onClick={() => setCloudSaveDialogOpen(true)}
            >
              <CloudUploadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download as .ipynb">
            <IconButton size="small" color="primary" onClick={onDownload}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Restart Kernel">
            <span>
              <IconButton
                size="small"
                color="primary"
                onClick={() => setRestartDialogOpen(true)}
                disabled={!jupyterServerIsAvailable}
              >
                <RestartAltIcon />
              </IconButton>
            </span>
          </Tooltip>
          {executingCellId && onCancel && (
            <Tooltip title="Cancel Execution">
              <IconButton size="small" color="error" onClick={onCancel}>
                <CancelIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </MuiToolbar>

      <Dialog
        open={restartDialogOpen}
        onClose={() => setRestartDialogOpen(false)}
        aria-labelledby="restart-dialog-title"
      >
        <DialogTitle id="restart-dialog-title">Restart Kernel?</DialogTitle>
        <DialogContent>
          This will clear all kernel state. Any variables or imports in your
          current session will be lost.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestartDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRestartSession}
            color="primary"
            variant="contained"
          >
            Restart
          </Button>
        </DialogActions>
      </Dialog>

      {cloudSaveDialogOpen && (
        <CloudSaveDialog
          open={true}
          onClose={() => setCloudSaveDialogOpen(false)}
          parsedUrlParams={parsedUrlParams}
          onSaveGist={onSaveGist}
          onUpdateGist={onUpdateGist}
          notebook={notebook}
        />
      )}

      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        aria-labelledby="reset-dialog-title"
      >
        <DialogTitle id="reset-dialog-title">
          {parsedUrlParams?.type === "github"
            ? "Reset to GitHub Version?"
            : parsedUrlParams?.type === "gist"
              ? "Reset to Gist Version?"
              : "Invalid parsedUrlParams"}
        </DialogTitle>
        <DialogContent>
          This will discard all local changes and reset the notebook to the
          version from{" "}
          {parsedUrlParams?.type === "github"
            ? "GitHub"
            : parsedUrlParams?.type === "gist"
              ? "the gist"
              : "Invalid parsedUrlParams"}
          .
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleResetToRemote}
            color="error"
            variant="contained"
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
};

export default Toolbar;
