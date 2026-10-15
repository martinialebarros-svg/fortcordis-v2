"use client";

import { useCallback, useState, type SetStateAction } from "react";
import {
  createEchoMeasurementState,
  importEchoMeasurementState,
  updateEchoMeasurementState,
} from "@/lib/echo-ae-ao-derivation";
import { clearReplacedOutflowProvenance } from "@/lib/echo-outflow-editor";

type Measurements = Record<string, string>;

/** Keep derived-ratio ownership atomic with measurements, outside the saved
 * clinical payload. Each mounted/replaced exam starts with its own state. */
export function useEchoMeasurements() {
  const [state, setState] = useState(() => createEchoMeasurementState());

  const setMeasurements = useCallback((action: SetStateAction<Measurements>) => {
    setState((previous) => updateEchoMeasurementState(
      previous,
      typeof action === "function" ? action(previous.measurements) : action,
    ));
  }, []);
  const importMeasurements = useCallback((imported: Measurements) => {
    setState((previous) => importEchoMeasurementState({
      ...previous,
      measurements: clearReplacedOutflowProvenance(previous.measurements, imported),
    }, imported));
  }, []);
  const replaceMeasurements = useCallback((measurements: Measurements) => {
    setState(createEchoMeasurementState(measurements));
  }, []);

  return { measurements: state.measurements, setMeasurements, importMeasurements, replaceMeasurements };
}
