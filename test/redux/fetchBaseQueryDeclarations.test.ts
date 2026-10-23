/** @jest-environment node */
import { dirname, resolve } from "path";
import ts from "typescript";

it("emits portable declarations while preserving the full base query context", () => {
  const configPath = resolve(__dirname, "../../tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const { fileNames, options, errors } = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath), {
    emitDeclarationOnly: true,
  });
  expect(config.error).toBeUndefined();
  expect(errors).toEqual([]);

  const consumerPath = resolve(__dirname, "../../src/context-regression.ts");
  const consumer = `
    import type { BaseQueryFn } from "@reduxjs/toolkit/query";
    import { fetchBaseQuery } from "./index";
    const query = fetchBaseQuery({ baseUrl: "/test/", paramsSerializer: () => "" });
    declare const dispatch: Parameters<BaseQueryFn>[1]["dispatch"];
    void query("test", {
      signal: new AbortController().signal, dispatch, getState: () => ({}),
      extra: undefined, endpoint: "test", type: "query",
    }, {});
    const wrapper: typeof query = async (args, api, extraOptions) => {
      api.dispatch({ type: "auth/clearCredentials" });
      return query(args, api, extraOptions);
    };
  `;
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  host.readFile = (file) => (file === consumerPath ? consumer : readFile(file));
  const program = ts.createProgram([...fileNames, consumerPath], options, host);
  expect(
    ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
  ).toEqual([]);

  const declarations = new Map<string, string>();
  const result = program.emit(undefined, (file, contents) => declarations.set(file, contents));
  expect(result.emitSkipped).toBe(false);
  expect(result.diagnostics).toEqual([]);

  const declaration = declarations.get(resolve(__dirname, "../../dist/redux/fetchBaseQuery.d.ts"));
  expect(declaration).toBeDefined();
  expect(declaration).not.toMatch(/@reduxjs\/toolkit\/dist\//);
});
