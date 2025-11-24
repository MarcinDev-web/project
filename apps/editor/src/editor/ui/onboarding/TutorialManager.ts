import { InteractiveTutorial, type TutorialConfig, type TutorialStep } from './InteractiveTutorial';
import type { EditorUI } from '../layout/EditorUI';
import { LogicCubeComponent } from '@engine/script';

export class TutorialManager {
  constructor(private editor: EditorUI) {}

  public startFirstGameTutorial(): void {
    const config = this.createFirstGameTutorial();
    const tutorial = new InteractiveTutorial(config);
    tutorial.start();
  }

  private createFirstGameTutorial(): TutorialConfig {
    return {
      steps: [
        {
          id: 'intro',
          title: 'Your First Game Logic',
          description: 'Let\'s make a simple interactive object! We will make a block that does something when clicked.',
          action: 'Start',
          position: 'center',
        },
        {
          id: 'select-object',
          title: 'Select an Object',
          description: 'Click on any block in the scene to select it.',
          validation: () => this.editor.state.selection.primarySelection !== null,
          position: 'center',
        },
        {
          id: 'open-logic-panel',
          title: 'Open Logic Panel',
          description: 'Click the "Logic" tab in the left sidebar.',
          highlightSelector: '[data-tab-id="logic"]',
          position: 'right',
          // Check if logic panel is active tab. Implementation depends on SidebarTabs exposure.
          // For now, we trust the user or check if panel container is visible
          validation: () => {
            const panel = document.querySelector('.logic-panel');
            return panel !== null && panel.offsetParent !== null;
          }
        },
        {
          id: 'add-logic',
          title: 'Add Logic Component',
          description: 'Click "Convert to Logic Cube" or enable the component if present.',
          highlightSelector: '.logic-panel',
          position: 'right',
          validation: () => {
             const entity = this.editor.state.selection.primarySelection;
             return entity !== null && entity.getComponent(LogicCubeComponent) !== undefined;
          }
        },
        {
          id: 'set-trigger',
          title: 'Set Trigger',
          description: 'Ensure "Cube Type" is set to "OnClick Trigger".',
          highlightSelector: '.logic-panel__select',
          position: 'right',
          validation: () => {
             const entity = this.editor.state.selection.primarySelection;
             const comp = entity?.getComponent(LogicCubeComponent);
             return comp !== undefined && comp.getCubeType() === 'onClickTrigger';
          }
        },
        {
          id: 'connect-hint',
          title: 'Connections',
          description: 'Great! Now you can connect this trigger to other objects (like an Action Cube) to make things happen. Explore the Logic Panel!',
          action: 'Finish',
          position: 'center'
        }
      ]
    };
  }
}

