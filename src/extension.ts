// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path = require("path");
import fs = require("fs");
import * as vscode from "vscode";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "minitools" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "minitools.localizeString",
    async (line: number) => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      const editor = vscode.window.activeTextEditor;

      if (editor && line) {
        const document = editor.document;
        let value: string | undefined = document
          .lineAt(line)
          .text.match("(\".*\"|'.*')")?.[0];
        if (value && vscode.workspace.workspaceFolders) {
          let startPos = document.lineAt(line).text.indexOf(value);
          let fullRange = new vscode.Range(
            new vscode.Position(line, startPos),
            new vscode.Position(line, startPos + value.length)
          );
          let range = new vscode.Range(
            new vscode.Position(line, startPos + 1),
            new vscode.Position(line, startPos + value.length - 1)
          );

          // Get the word within the selection
          var text = document.getText(range);
          const param = text.match(new RegExp("[$][^ ]+"))?.[0];

          if (param != null) {
            text = text.replace(param, "{n, plural, =1{one n} other{{n} ns}}");
          }

          const german = await vscode.window.showInputBox({
            title: "German Text",
            value: text,
          });
          if (!german) return;

          const english = await vscode.window.showInputBox({
            title: "English Text",
            value: text,
          });
          if (!english) return;

          var localizationName: string | undefined = english
            .trim()
            .replace(/[^a-zA-Z ]/g, "")
            .split(" ")
            .slice(0, 5)
            .map((s, i) =>
              i > 0
                ? s.charAt(0).toUpperCase() + s.slice(1)
                : s.charAt(0).toLowerCase() + s.slice(1)
            )
            .join("");

          localizationName = await vscode.window.showInputBox({
            title: "Localization Name",
            value: localizationName,
          });
          if (!localizationName) return;

          const arbDE = path.join(
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            "lib",
            "l10n",
            "app_de.arb"
          );

          const arbEN = path.join(
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            "lib",
            "l10n",
            "app_en.arb"
          );
          updateArbFile(arbDE, `\"${localizationName}\": \"${german}\"`);
          updateArbFile(arbEN, `\"${localizationName}\": \"${english}\"`);
          if (param) {
            updateArbFile(
              arbEN,
              `\"@${localizationName}\": {
        "placeholders": {
            "n": {
                "type": "int"
            }
        }
    }`
            );
          }

          console.log(text);
          editor.edit((editBuilder) => {
            editBuilder.replace(
              fullRange,
              param
                ? `AppLocalizations.of(context).${localizationName}(${param
                    .replace("$", "")
                    .replace("{", "")
                    .replace("}", "")})`
                : `AppLocalizations.of(context).${localizationName}`
            );
            if (
              !document
                .getText()
                .includes(
                  "import 'package:flutter_gen/gen_l10n/app_localizations.dart';"
                )
            )
              editBuilder.insert(
                new vscode.Position(0, 0),
                "import 'package:flutter_gen/gen_l10n/app_localizations.dart';\n"
              );
          });
        }
      }
    },
    context
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: "dart", scheme: "file" },
      new SourceCodeActionProvider(),
      SourceCodeActionProvider.metadata
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}

export function updateArbFile(file: string, newDefinition: string) {
  var data = fs.readFileSync(file, "utf-8").trimEnd();
  data = data.substring(0, data.length - 1).trimEnd();
  data += `,\n    ${newDefinition}\n\}\n`;
  fs.writeFileSync(file, data);
}

export class SourceCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [vscode.CodeActionKind.RefactorExtract],
  };

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    const actions = [];

    if (
      document.lineAt(range.start.line).text.includes('"') ||
      document.lineAt(range.start.line).text.includes("'")
    ) {
      actions.push({
        command: {
          command: "minitools.localizeString",
          title: "Localize String",
          arguments: [range.start.line],
        },
        kind: vscode.CodeActionKind.RefactorExtract,
        title: "Localize String",
      });
    }

    return actions;
  }
}
