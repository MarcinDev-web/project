const fs = require('fs');
const path = require('path');

const baseDir = path.join('apps', 'editor', 'src', 'editor', 'panels');

// Map files to their new subdirectories
const fileMap = {
    'EditorPanelManager.ts': 'core',
    'UIPanel.ts': 'core',
    'EditorPanelManager.test.ts': 'core',
    'ui-panel.css': 'core',
    'LayersPanel.ts': 'scene',
    'PropertiesPanel.ts': 'scene',
    'HistoryPanel.ts': 'scene',
    'BookmarksPanel.ts': 'scene',
    'RenderSettingsPanel.ts': 'scene',
    'LayersPanel.test.ts': 'scene',
    'PropertiesPanel.test.ts': 'scene',
    'HistoryPanel.test.ts': 'scene',
    'BookmarksPanel.test.ts': 'scene',
    'LogicPanel.ts': 'gameplay',
    'EconomyPanel.ts': 'gameplay',
    'NpcPanel.ts': 'gameplay',
    'WeaponPanel.ts': 'gameplay',
    'VegetationPanel.ts': 'gameplay',
    'LogicPanel.test.ts': 'gameplay',
    'WeaponPanel.test.ts': 'gameplay',
    'MarketplacePanel.ts': 'content',
    'TemplateGalleryPanel.ts': 'content',
    'ModelBuilderPanel.ts': 'content',
    'SettingsPanel.ts': 'settings',
    'QuickActionsPanel.ts': 'settings',
};

function updateImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const subdir = path.basename(path.dirname(filePath));
    
    if (subdir === 'panels') return; // Should not happen
    
    const lines = content.split('\n');
    const newLines = lines.map(line => {
        // Check for import/export lines
        if (!line.trim().startsWith('import ') && !line.trim().startsWith('export * from') && !line.trim().startsWith('import(')) {
            return line;
        }

        // Replace path logic
        return line.replace(/(from\s+|import\s+|import\()(["'])([^"']+)(["'])/g, (match, prefix, quote1, importPath, quote2) => {
            let newPath = importPath;
            
            // 1. Handle parent imports (../)
            if (importPath.startsWith('../')) {
                newPath = '../' + importPath;
            }
            // 2. Handle sibling imports (./)
            else if (importPath.startsWith('./')) {
                const filename = path.basename(importPath);
                // Strip extension if present, or try to guess
                let lookupName = filename;
                if (!lookupName.endsWith('.ts') && !lookupName.endsWith('.css')) {
                    // Likely a TS file import without extension
                    // Try matching with known files
                    if (fileMap[lookupName + '.ts']) {
                        lookupName = lookupName + '.ts';
                    }
                }

                if (fileMap[lookupName]) {
                    const targetSubdir = fileMap[lookupName];
                    if (targetSubdir === subdir) {
                        // Same dir, keep ./
                    } else {
                        newPath = `../${targetSubdir}/${filename}`;
                    }
                } else if (lookupName === 'UIPanel' || lookupName === 'ui-panel.css') {
                    // Special case fallback if not in map (though they are in map)
                     if (subdir === 'core') {
                         // keep ./
                     } else {
                         newPath = `../core/${filename}`;
                     }
                } else {
                    // Default sibling -> same dir
                }
            }
            
            return `${prefix}${quote1}${newPath}${quote2}`;
        });
    });
    
    return newLines.join('\n');
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.ts')) {
             if (file === 'EditorPanelManager.ts') continue;
             console.log(`Processing ${fullPath}`);
             const newContent = updateImports(fullPath);
             fs.writeFileSync(fullPath, newContent);
        }
    }
}

walkDir(baseDir);
console.log('Finished updating imports.');
