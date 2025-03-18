import {
  emptyCodeCell,
  emptyMarkdownCell,
  fromJS,
  ImmutableCodeCell,
  ImmutableNotebook,
  insertCellAfter,
  toJS,
} from "@nteract/commutable";
import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PythonSessionClient from "src/jupyter/PythonSessionClient";
import saveAsGitHubGist, {
  updateGitHubGist,
} from "../../gists/saveAsGitHubGist";
import {
  fetchNotebook,
  loadNotebookFromStorage,
  ParsedUrlParams,
} from "../../shared/util/indexedDb";
import executeCell from "./executeCell";
import {
  addCellAfterCell,
  addCellBeforeCell,
  deleteActiveCell,
} from "./notebook/notebook-cell-operations";
import { ExecutionAction, ExecutionState } from "./notebook/notebook-execution";
import { setSpecialContextForAI } from "./useCodeCompletions";
import { makeRandomId } from "./utils";

export const useScrollToActiveCellOld = (activeCellId: string | undefined) => {
  // Scroll active cell into view when it changes
  useEffect(() => {
    if (activeCellId) {
      const activeElement = document.querySelector(
        `[data-cell-id="${activeCellId}"]`,
      );
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [activeCellId]);
};

export const useScrollToActiveCell = (activeCellId: string | undefined) => {
  // Scroll active cell into view when it changes, but only within the notebook's scroll container
  useEffect(() => {
    if (activeCellId) {
      const scrollContainer = document.querySelector(
        '[data-testid="notebook-scroll-container"]',
      );
      if (!scrollContainer) return;

      const scrollContainerHeight = scrollContainer.clientHeight;
      const aa = Math.min((scrollContainerHeight * 2) / 3, 200);

      const activeElement = scrollContainer.querySelector(
        `[data-cell-id="${activeCellId}"]`,
      );
      if (activeElement && scrollContainer instanceof HTMLElement) {
        // get bounding rectangles
        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = activeElement.getBoundingClientRect();

        // if the top of the element is above the visible area, scroll it to the top
        if (elementRect.top < containerRect.top) {
          console.log("---- 1");
          scrollContainer.scrollTop += elementRect.top - containerRect.top;
        }
        // if the bottom of the element is below the visible area, scroll it so the bottom
        // ends up 200 pixels above the container's bottom edge
        else if (elementRect.top > containerRect.bottom - aa) {
          console.log("---- 2");
          scrollContainer.scrollTop +=
            elementRect.top - (containerRect.bottom - aa);
        }
      }
    }
  }, [activeCellId]);
};

export const useLoadRemoteNotebook = (
  parsedUrlParams: ParsedUrlParams | null,
  localname: string | undefined,
  setLoadError: (e: string | undefined) => void,
  setRemoteNotebook: (n: ImmutableNotebook) => void,
  setRemoteNotebookFilePath: (p: string) => void,
  setNotebook: (n: ImmutableNotebook) => void,
  setActiveCellId: (id: string) => void,
) => {
  return useCallback(async () => {
    if (!parsedUrlParams) return;
    try {
      setLoadError(undefined);
      const { notebookContent: notebookData, filePath: notebookFilePath } =
        await fetchNotebook(parsedUrlParams);
      const reconstructedNotebook: ImmutableNotebook = fromJS(notebookData);
      setRemoteNotebook(reconstructedNotebook);
      setRemoteNotebookFilePath(notebookFilePath);
      const localModifiedNotebook = await loadNotebookFromStorage(
        parsedUrlParams,
        localname,
      );
      const localModifiedNotebookReconstructed: ImmutableNotebook | null =
        localModifiedNotebook ? fromJS(localModifiedNotebook) : null;
      const notebook0 =
        localModifiedNotebookReconstructed || reconstructedNotebook;

      setNotebook(notebook0);
      if (notebook0.cellOrder.size > 0) {
        setActiveCellId(notebook0.cellOrder.first());
      }
    } catch (error) {
      console.error("Error loading GitHub or Gist notebook:", error);
      setLoadError(
        `Failed to load notebook from GitHub or Gist: ${(error as Error).message}`,
      );
    }
  }, [
    parsedUrlParams,
    localname,
    setLoadError,
    setRemoteNotebook,
    setRemoteNotebookFilePath,
    setNotebook,
    setActiveCellId,
  ]);
};

export const useLoadSavedNotebook = (
  parsedUrlParams: ParsedUrlParams | null,
  localname: string | undefined,
  loadRemoteNotebook: () => void,
  setLoadError: (e: string | undefined) => void,
  setNotebook: (n: ImmutableNotebook) => void,
  setActiveCellId: (id: string) => void,
) => {
  useEffect(() => {
    if (parsedUrlParams) {
      loadRemoteNotebook();
    } else {
      loadNotebookFromStorage(parsedUrlParams, localname)
        .then((savedNotebook) => {
          if (savedNotebook) {
            const reconstructedNotebook = fromJS(savedNotebook);
            setNotebook(reconstructedNotebook);
            if (reconstructedNotebook.cellOrder.size > 0) {
              setActiveCellId(reconstructedNotebook.cellOrder.first());
            }
          }
        })
        .catch((error) => {
          console.error("Error loading notebook:", error);
          setLoadError("Failed to load saved notebook");
        });
    }
  }, [
    parsedUrlParams,
    loadRemoteNotebook,
    localname,
    setLoadError,
    setNotebook,
    setActiveCellId,
  ]);
};

export const useExecute = (
  currentCellExecution: ExecutionState,
  dispatchExecution: (action: ExecutionAction) => void,
  activeCellId: string | undefined,
  notebook: ImmutableNotebook,
  setNotebook: (n: ImmutableNotebook) => void,
  sessionClient: PythonSessionClient | null,
  canceledRef: React.MutableRefObject<boolean>,
  setActiveCellId: (id: string | undefined) => void,
  setCellIdRequiringFocus: (id: string | null) => void,
  paperRef: React.RefObject<HTMLDivElement>,
) => {
  return useCallback(
    async ({ advance }: { advance: boolean }) => {
      if (currentCellExecution.executingCellId) {
        console.warn("Cell already executing");
        return;
      }
      if (!activeCellId) return;
      const cell = notebook.cellMap.get(activeCellId);
      if (!cell) return;

      let newNotebook = notebook;
      if (cell.cell_type === "code") {
        if (!sessionClient) {
          console.warn("Python session client not available");
          return;
        }
        const codeCell = cell as ImmutableCodeCell;

        const newCodeCell = codeCell.set("outputs", emptyCodeCell.outputs);
        newNotebook = newNotebook.setIn(["cellMap", activeCellId], newCodeCell);
        setNotebook(newNotebook);

        dispatchExecution({ type: "start-execution", cellId: activeCellId });

        canceledRef.current = false;
        await executeCell(
          newCodeCell.get("source"),
          sessionClient,
          (outputs) => {
            const newCodeCell = codeCell.set("outputs", outputs);
            newNotebook = newNotebook.setIn(
              ["cellMap", activeCellId],
              newCodeCell,
            );
            setNotebook(newNotebook);
          },
          canceledRef,
        );

        dispatchExecution({ type: "end-execution", cellId: activeCellId });
      } else if (cell.cell_type === "markdown") {
        dispatchExecution({ type: "start-execution", cellId: activeCellId });
        dispatchExecution({ type: "end-execution", cellId: activeCellId });
      }

      if (advance) {
        const currentIndex = newNotebook.cellOrder.indexOf(activeCellId);
        if (currentIndex === newNotebook.cellOrder.size - 1) {
          const newId: string = makeRandomId();
          const newCodeCell = emptyCodeCell.set("source", ``);
          newNotebook = insertCellAfter(
            newNotebook,
            newCodeCell,
            newId,
            activeCellId,
          );
          setActiveCellId(newId);
          setCellIdRequiringFocus(newId);
        } else {
          setActiveCellId(newNotebook.cellOrder.get(currentIndex + 1));
          paperRef.current?.focus();
          setCellIdRequiringFocus(null);
        }
      }
      setNotebook(newNotebook);
    },
    [
      currentCellExecution,
      dispatchExecution,
      activeCellId,
      notebook,
      setNotebook,
      sessionClient,
      canceledRef,
      setActiveCellId,
      setCellIdRequiringFocus,
      paperRef,
    ],
  );
};

export const useGoToPreviousNextCell = (
  activeCellId: string | undefined,
  setActiveCellId: (id: string | undefined) => void,
  setCellIdRequiringFocus: (id: string | null) => void,
  notebook: ImmutableNotebook,
) => {
  const handleGoToPreviousCell = useCallback(() => {
    if (!activeCellId) return;
    const currentIndex = notebook.cellOrder.indexOf(activeCellId);
    if (currentIndex > 0) {
      setActiveCellId(notebook.cellOrder.get(currentIndex - 1));
      setCellIdRequiringFocus(null);
    }
  }, [activeCellId, notebook, setActiveCellId, setCellIdRequiringFocus]);

  const handleGoToNextCell = useCallback(() => {
    if (!activeCellId) return;
    const currentIndex = notebook.cellOrder.indexOf(activeCellId);
    if (currentIndex < notebook.cellOrder.size - 1) {
      setActiveCellId(notebook.cellOrder.get(currentIndex + 1));
      setCellIdRequiringFocus(null);
    }
  }, [activeCellId, notebook, setActiveCellId, setCellIdRequiringFocus]);

  return {
    handleGoToPreviousCell,
    handleGoToNextCell,
  };
};

export const useToggleCellType = (
  notebook: ImmutableNotebook,
  setNotebook: (n: ImmutableNotebook) => void,
) => {
  return useCallback(
    (cellId: string) => {
      const cell = notebook.cellMap.get(cellId);
      if (!cell) return;
      // Create new cell of opposite type with same source
      let newCell;
      if (cell.cell_type === "code") {
        newCell = emptyMarkdownCell
          .set("source", cell.get("source"))
          .set("metadata", cell.get("metadata"));
      } else if (cell.cell_type === "markdown") {
        newCell = emptyCodeCell
          .set("source", cell.get("source"))
          .set("metadata", cell.get("metadata"));
      }
      const newNotebook = notebook.setIn(["cellMap", cellId], newCell);
      setNotebook(newNotebook);
    },
    [notebook, setNotebook],
  );
};

export const useCellOperations = (
  notebook: ImmutableNotebook,
  setNotebook: (n: ImmutableNotebook) => void,
  setActiveCellId: (id: string | undefined) => void,
  setCellIdRequiringFocus: (id: string | null) => void,
) => {
  const handleAddCellAfterCell = useCallback(
    (cellId: string) => {
      const { newNotebook, newCellId } = addCellAfterCell(notebook, cellId);
      setActiveCellId(newCellId);
      setCellIdRequiringFocus(null);
      setNotebook(newNotebook);
    },
    [notebook, setNotebook, setActiveCellId, setCellIdRequiringFocus],
  );

  const handleAddCellBeforeCell = useCallback(
    (cellId: string) => {
      const v = addCellBeforeCell(notebook, cellId || "");
      if (!v) return;
      setActiveCellId(v.newCellId);
      setCellIdRequiringFocus(null);
      setNotebook(v.newNotebook);
    },
    [notebook, setNotebook, setActiveCellId, setCellIdRequiringFocus],
  );

  const handleDeleteCell = useCallback(
    (cellId: string) => {
      const { newNotebook, newActiveCellId } = deleteActiveCell(
        notebook,
        cellId,
      );
      setNotebook(newNotebook);
      setActiveCellId(newActiveCellId);
    },
    [notebook, setNotebook, setActiveCellId],
  );

  return {
    handleAddCellBeforeCell,
    handleAddCellAfterCell,
    handleDeleteCell,
  };
};

export const useSpecialContextForAI = (
  notebook: ImmutableNotebook,
  activeCellId: string | undefined,
) => {
  useEffect(() => {
    // All code in cells leading up to the active cell
    let codeCells = "";
    for (const cellId of notebook.cellOrder) {
      if (cellId === activeCellId) break;
      const cell = notebook.cellMap.get(cellId);
      if (!cell) continue;
      if (cell.cell_type === "code") {
        codeCells += cell.get("source") + "\n\n";
      }
    }
    setSpecialContextForAI(codeCells);
  }, [notebook, activeCellId]);
};

export const useSaveGist = (
  notebook: ImmutableNotebook,
  setRemoteNotebook: (n: ImmutableNotebook) => void,
) => {
  const navigate = useNavigate();
  return useMemo(
    () => async (token: string, fileName: string) => {
      const gistUri = await saveAsGitHubGist(
        {
          [fileName]: JSON.stringify(toJS(notebook), null, 2),
        },
        {
          defaultDescription: "Notebook saved from nbfiddle",
          personalAccessToken: token,
        },
      );
      setRemoteNotebook(fromJS(toJS(notebook)));
      // replace special characters with "-"
      const morphedFileName = fileName.replace(/[^a-zA-Z0-9]/g, "-");
      navigate(`?url=${gistUri}%23file-${morphedFileName}`);
    },
    [notebook, navigate, setRemoteNotebook],
  );
};

export const useUpdateGist = (
  notebook: ImmutableNotebook,
  setRemoteNotebook: (n: ImmutableNotebook) => void,
  remoteNotebookFilePath: string | null,
  parsedUrlParams: ParsedUrlParams | null,
) => {
  return useMemo(
    () => async (token: string) => {
      if (!remoteNotebookFilePath) {
        throw new Error("No remote notebook file path");
      }
      if (!parsedUrlParams) {
        throw new Error("No parsed URL params");
      }
      if (parsedUrlParams.type !== "gist") {
        throw new Error("Not a Gist");
      }
      const gistUri = `https://gist.github.com/${parsedUrlParams.owner}/${parsedUrlParams.gistId}`;
      await updateGitHubGist(
        gistUri,
        { [remoteNotebookFilePath]: JSON.stringify(toJS(notebook), null, 2) },
        {
          personalAccessToken: token,
        },
      );
      setRemoteNotebook(fromJS(toJS(notebook)));
    },
    [notebook, remoteNotebookFilePath, parsedUrlParams, setRemoteNotebook],
  );
};
