import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { EditorWidget } from '@theia/editor/lib/browser';
import { LabelProvider } from '@theia/core/lib/browser';
import { EditorWidgetFactory as TheiaEditorWidgetFactory } from '@theia/editor/lib/browser/editor-widget-factory';
import { SketchesServiceClientImpl } from '../../../common/protocol/sketches-service-client-impl';
import { SketchesService, Sketch } from '../../../common/protocol';
import { nls } from '@theia/core/lib/common';

@injectable()
export class EditorWidgetFactory extends TheiaEditorWidgetFactory {
  @inject(SketchesService)
  protected readonly sketchesService: SketchesService;

  @inject(SketchesServiceClientImpl)
  protected readonly sketchesServiceClient: SketchesServiceClientImpl;

  @inject(LabelProvider)
  protected readonly labelProvider: LabelProvider;

  protected async createEditor(uri: URI): Promise<EditorWidget> {
    const widget = await super.createEditor(uri);
    return this.maybeUpdateCaption(widget);
  }

  protected async maybeUpdateCaption(
    widget: EditorWidget
  ): Promise<EditorWidget> {
    const sketch = await this.sketchesServiceClient.currentSketch();
    const { uri } = widget.editor;
    if (sketch && Sketch.isInSketch(uri, sketch)) {
      const isTemp = await this.sketchesService.isTemp(sketch);
      if (isTemp) {
        widget.title.caption = nls.localize(
          'theia/editor/unsavedTitle',
          'Unsaved – {0}',
          this.labelProvider.getName(uri)
        );
      }
    }
    return widget;
  }
}
