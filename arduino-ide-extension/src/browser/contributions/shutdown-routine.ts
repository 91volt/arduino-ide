import { FrontendApplicationContribution } from "@theia/core/lib/browser/frontend-application";
import { inject, injectable } from "@theia/core/shared/inversify";
import * as remote from '@theia/core/electron-shared/@electron/remote';
import { SketchesServiceClientImpl } from "../../common/protocol/sketches-service-client-impl";
import { SketchesService } from "../../common/protocol/sketches-service";
import { Dialog } from "@theia/core/lib/browser/dialogs";
import { nls } from "@theia/core/lib/common/nls";
import { CommandRegistry } from "@theia/core/lib/common/command";
import { ApplicationShell } from "@theia/core/lib/browser/shell/application-shell";
import { SaveAsSketch } from "./save-as-sketch";
import { WindowService } from "@theia/core/lib/browser/window/window-service";

@injectable()
export class ShutdownRoutine implements FrontendApplicationContribution {

  @inject(SketchesServiceClientImpl)
  protected readonly sketchServiceClient: SketchesServiceClientImpl;

  @inject(SketchesService)
  protected readonly sketchService: SketchesService;

  @inject(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  @inject(ApplicationShell)
  protected readonly appShell: ApplicationShell;

  @inject(WindowService)
  protected readonly windowService: WindowService;
    
  initialize(): void {
    this.setupShutdownRoutine(remote.getCurrentWindow());
  }

  setupShutdownRoutine(electronWindow: Electron.BrowserWindow): void {
    window.addEventListener('beforeunload', event => {
      if (!this.windowService.isSafeToShutDown()) {
        event.preventDefault();
        event.returnValue = false;
        this.confirmShutdown(electronWindow).then(result => {
          if (result) {
            electronWindow.destroy();
          }
        });
      }
    });
  }

  private async confirmShutdown(window: Electron.BrowserWindow): Promise<boolean> {
    const sketch = await this.sketchServiceClient.currentSketch();
    if (sketch) {
      const isTemp = await this.sketchService.isTemp(sketch);
      if (isTemp) {
        return this.showTempSketchDialog(window);
      } else if (this.appShell.canSaveAll()) {
        const dialogResult = await remote.dialog.showMessageBox(window, {
          title: nls.localize('theia/core/quitTitle', 'Are you sure you want to quit?'),
          message: nls.localize('theia/core/quitMessage', 'Any unsaved changes will not be saved.'),
          buttons: [
            Dialog.NO,
            Dialog.YES
          ]
        });
        return dialogResult.response === 1;
      }
    }
    return true;
  }

  private async showTempSketchDialog(window: Electron.BrowserWindow): Promise<boolean> {
    const sketch = await this.sketchServiceClient.currentSketch();
    if (!sketch) {
      return true;
    }
    const isTemp = await this.sketchService.isTemp(sketch);
    if (!isTemp) {
      return true;
    }
    const messageBoxResult = await remote.dialog.showMessageBox(
      window,
      {
        message: nls.localize('arduino/sketch/saveTempSketch', 'Save your sketch to open it again later.'),
        title: 'Arduino-IDE',
        type: 'question',
        buttons: [
          Dialog.CANCEL,
          nls.localizeByDefault('Save As...'),
          nls.localizeByDefault("Don't Save"),
        ],
      }
    )
    const result = messageBoxResult.response;
    if (result === 2) {
      return true;
    } else if (result === 1) {
      return !!(await this.commandRegistry.executeCommand(
        SaveAsSketch.Commands.SAVE_AS_SKETCH.id,
        {
          execOnlyIfTemp: false,
          openAfterMove: false,
          wipeOriginal: true
        }
      ));
    }
    return false
  }

}
