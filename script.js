// DOM Elements
const codeInput = document.getElementById( 'codeInput' );
const output = document.getElementById( 'output' );
const analyzeBtn = document.getElementById( 'analyzeBtn' );
const generateBtn = document.getElementById( 'generateBtn' );
const copyBtn = document.getElementById( 'copyBtn' );
const downloadBtn = document.getElementById( 'downloadBtn' );
const customToggle = document.getElementById( 'customToggle' );
const customOptions = document.getElementById( 'customOptions' );
const settingsList = document.getElementById( 'settingsList' );
const toast = document.getElementById( 'toast' );
const toastMessage = document.getElementById( 'toastMessage' );

// Settings elements
const indentWidth = document.getElementById( 'indentWidth' );
const useTabs = document.getElementById( 'useTabs' );
const spacesInParens = document.getElementById( 'spacesInParens' );
const spaceInEmptyParens = document.getElementById( 'spaceInEmptyParens' );
const spacesInAngles = document.getElementById( 'spacesInAngles' );
const spacesInSquare = document.getElementById( 'spacesInSquare' );
const braceStyle = document.getElementById( 'braceStyle' );
const spaceBeforeParens = document.getElementById( 'spaceBeforeParens' );
const pointerAlign = document.getElementById( 'pointerAlign' );
const columnLimit = document.getElementById( 'columnLimit' );

// Default LLVM settings (baseline)
const defaultSettings = {
    IndentWidth: 2,
    UseTab: false,
    SpacesInParentheses: false,
    SpaceInEmptyParentheses: false,
    SpacesInAngles: false,
    SpacesInSquareBrackets: false,
    BreakBeforeBraces: 'Attach',
    SpaceBeforeParens: 'ControlStatements',
    PointerAlignment: 'Right',
    ColumnLimit: 80
};

// Toggle customization panel
customToggle.addEventListener( 'click', () => {
    customOptions.classList.toggle( 'open' );
    customToggle.querySelector( '.toggle-icon' ).classList.toggle( 'rotated' );
} );

// Analyze code button
analyzeBtn.addEventListener( 'click', () => {
    const code = codeInput.value;
    if ( !code.trim() ) {
        showToast( 'Please enter some code first', 'warning' );
        return;
    }
    
    const detected = analyzeCode( code );
    updateSettingsFromDetected( detected );
    displayDetectedSettings( detected );
    generateClangFormat();
} );

// Generate button
generateBtn.addEventListener( 'click', generateClangFormat );

// Copy button
copyBtn.addEventListener( 'click', () => {
    const text = output.textContent;
    if ( text.includes( 'Click "Generate"' ) ) {
        showToast( 'Generate a config first', 'warning' );
        return;
    }
    
    navigator.clipboard.writeText( text ).then( () => {
        showToast( 'Copied to clipboard!' );
    } );
} );

// Download button
downloadBtn.addEventListener( 'click', () => {
    const text = output.textContent;
    if ( text.includes( 'Click "Generate"' ) ) {
        showToast( 'Generate a config first', 'warning' );
        return;
    }
    
    const blob = new Blob( [ text ], { type: 'text/plain' } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = '.clang-format';
    document.body.appendChild( a );
    a.click();
    document.body.removeChild( a );
    URL.revokeObjectURL( url );
    showToast( 'File downloaded!' );
} );

// Analyze code for style patterns
function analyzeCode( code ) {
    const detected = {};
    
    // Detect spaces in parentheses: func( x ) vs func(x)
    if ( /\(\s+\S/.test( code ) && /\S\s+\)/.test( code ) ) {
        detected.SpacesInParentheses = true;
    } else if ( /\(\S/.test( code ) && /\S\)/.test( code ) ) {
        detected.SpacesInParentheses = false;
    }
    
    // Detect space in empty parentheses: func( ) vs func()
    if ( /\(\s+\)/.test( code ) ) {
        detected.SpaceInEmptyParentheses = true;
    } else if ( /\(\)/.test( code ) ) {
        detected.SpaceInEmptyParentheses = false;
    }
    
    // Detect spaces in angle brackets: < int > vs <int>
    if ( /<\s+\w/.test( code ) && /\w\s+>/.test( code ) ) {
        detected.SpacesInAngles = true;
    } else if ( /<\w/.test( code ) && /\w>/.test( code ) ) {
        detected.SpacesInAngles = false;
    }
    
    // Detect spaces in square brackets: [ i ] vs [i]
    if ( /\[\s+\w/.test( code ) && /\w\s+\]/.test( code ) ) {
        detected.SpacesInSquareBrackets = true;
    } else if ( /\[\w/.test( code ) && /\w\]/.test( code ) ) {
        detected.SpacesInSquareBrackets = false;
    }
    
    // Detect brace style
    if ( /\)\s*\n\s*\{/.test( code ) ) {
        detected.BreakBeforeBraces = 'Allman';
    } else if ( /\)\s*\{/.test( code ) ) {
        detected.BreakBeforeBraces = 'Attach';
    }
    
    // Detect indentation
    const lines = code.split( '\n' );
    for ( const line of lines ) {
        const match = line.match( /^(\s+)\S/ );
        if ( match ) {
            const indent = match[ 1 ];
            if ( indent.includes( '\t' ) ) {
                detected.UseTab = true;
                detected.IndentWidth = 4;
            } else {
                detected.UseTab = false;
                detected.IndentWidth = indent.length;
            }
            break;
        }
    }
    
    // Detect space before parens in control statements: if ( vs if(
    if ( /\b(if|for|while|switch)\s+\(/.test( code ) ) {
        detected.SpaceBeforeControlStatementParens = true;
    } else if ( /\b(if|for|while|switch)\(/.test( code ) ) {
        detected.SpaceBeforeControlStatementParens = false;
    }
    
    // Detect space before function parens: func ( vs func(
    if ( /\w\s+\(\s*\)/.test( code ) && !/\b(if|for|while|switch)\s+\(/.test( code ) ) {
        detected.SpaceBeforeParens = 'Always';
    } else if ( /\b(if|for|while|switch)\s+\(/.test( code ) && /\w\(\s*\)/.test( code ) ) {
        detected.SpaceBeforeParens = 'ControlStatements';
    }
    
    // Detect pointer alignment: int* p vs int *p vs int * p
    if ( /\w+\*\s+\w/.test( code ) ) {
        detected.PointerAlignment = 'Left';
    } else if ( /\w+\s+\*\w/.test( code ) ) {
        detected.PointerAlignment = 'Right';
    } else if ( /\w+\s+\*\s+\w/.test( code ) ) {
        detected.PointerAlignment = 'Middle';
    }
    
    return detected;
}

// Update UI settings from detected values
function updateSettingsFromDetected( detected ) {
    if ( detected.IndentWidth !== undefined ) {
        indentWidth.value = detected.IndentWidth;
    }
    if ( detected.UseTab !== undefined ) {
        useTabs.checked = detected.UseTab;
    }
    if ( detected.SpacesInParentheses !== undefined ) {
        spacesInParens.checked = detected.SpacesInParentheses;
    }
    if ( detected.SpaceInEmptyParentheses !== undefined ) {
        spaceInEmptyParens.checked = detected.SpaceInEmptyParentheses;
    }
    if ( detected.SpacesInAngles !== undefined ) {
        spacesInAngles.checked = detected.SpacesInAngles;
    }
    if ( detected.SpacesInSquareBrackets !== undefined ) {
        spacesInSquare.checked = detected.SpacesInSquareBrackets;
    }
    if ( detected.BreakBeforeBraces !== undefined ) {
        braceStyle.value = detected.BreakBeforeBraces;
    }
    if ( detected.SpaceBeforeParens !== undefined ) {
        spaceBeforeParens.value = detected.SpaceBeforeParens;
    }
    if ( detected.PointerAlignment !== undefined ) {
        pointerAlign.value = detected.PointerAlignment;
    }
}

// Display detected settings as tags
function displayDetectedSettings( detected ) {
    const keys = Object.keys( detected );
    
    if ( keys.length === 0 ) {
        settingsList.innerHTML = '<p class="no-settings">No patterns detected</p>';
        return;
    }
    
    let html = '';
    for ( const key of keys ) {
        const value = detected[ key ];
        html += `<span class="setting-tag">
            <span class="tag-name">${key}:</span>
            <span class="tag-value">${value}</span>
        </span>`;
    }
    settingsList.innerHTML = html;
}

// Generate .clang-format content
function generateClangFormat() {
    const settings = getCurrentSettings();
    const changedSettings = getChangedSettings( settings );
    
    if ( Object.keys( changedSettings ).length === 0 ) {
        output.innerHTML = '<span class="comment"># No changes from default LLVM style</span>\n' +
                          '<span class="key">BasedOnStyle</span>: <span class="value">LLVM</span>';
        return;
    }
    
    let content = '# Generated by Clang-Format Generator\n';
    content += '# Only includes settings that differ from LLVM defaults\n\n';
    content += 'BasedOnStyle: LLVM\n';
    content += 'Language: Cpp\n\n';
    
    // Group settings by category
    const categories = {
        'Indentation': [ 'IndentWidth', 'TabWidth', 'UseTab' ],
        'Spacing': [ 'SpacesInParentheses', 'SpaceInEmptyParentheses', 'SpacesInAngles', 
                    'SpacesInSquareBrackets', 'SpacesInContainerLiterals' ],
        'Braces': [ 'BreakBeforeBraces' ],
        'Parentheses': [ 'SpaceBeforeParens' ],
        'Alignment': [ 'PointerAlignment' ],
        'Line': [ 'ColumnLimit' ]
    };
    
    for ( const [ category, keys ] of Object.entries( categories ) ) {
        const categorySettings = keys.filter( k => changedSettings[ k ] !== undefined );
        if ( categorySettings.length > 0 ) {
            content += `# ${category}\n`;
            for ( const key of categorySettings ) {
                content += formatSetting( key, changedSettings[ key ] );
            }
            content += '\n';
        }
    }
    
    // Display with syntax highlighting
    output.innerHTML = highlightYaml( content );
    showToast( 'Configuration generated!' );
}

// Get current settings from UI
function getCurrentSettings() {
    return {
        IndentWidth: parseInt( indentWidth.value ),
        TabWidth: parseInt( indentWidth.value ),
        UseTab: useTabs.checked ? 'Always' : 'Never',
        SpacesInParentheses: spacesInParens.checked,
        SpaceInEmptyParentheses: spaceInEmptyParens.checked,
        SpacesInAngles: spacesInAngles.checked,
        SpacesInSquareBrackets: spacesInSquare.checked,
        SpacesInContainerLiterals: spacesInParens.checked,
        BreakBeforeBraces: braceStyle.value,
        SpaceBeforeParens: spaceBeforeParens.value,
        PointerAlignment: pointerAlign.value,
        ColumnLimit: parseInt( columnLimit.value )
    };
}

// Get only settings that differ from defaults
function getChangedSettings( settings ) {
    const changed = {};
    
    // Map to defaults
    const defaultMap = {
        IndentWidth: 2,
        TabWidth: 2,
        UseTab: 'Never',
        SpacesInParentheses: false,
        SpaceInEmptyParentheses: false,
        SpacesInAngles: false,
        SpacesInSquareBrackets: false,
        SpacesInContainerLiterals: false,
        BreakBeforeBraces: 'Attach',
        SpaceBeforeParens: 'ControlStatements',
        PointerAlignment: 'Right',
        ColumnLimit: 80
    };
    
    for ( const [ key, value ] of Object.entries( settings ) ) {
        if ( defaultMap[ key ] !== undefined && defaultMap[ key ] !== value ) {
            changed[ key ] = value;
        }
    }
    
    return changed;
}

// Format a single setting for YAML
function formatSetting( key, value ) {
    if ( typeof value === 'boolean' ) {
        return `${key}: ${value}\n`;
    } else if ( typeof value === 'number' ) {
        return `${key}: ${value}\n`;
    } else {
        return `${key}: ${value}\n`;
    }
}

// Syntax highlight YAML
function highlightYaml( content ) {
    return content
        .replace( /(#.*)/g, '<span class="comment">$1</span>' )
        .replace( /^(\w+):/gm, '<span class="key">$1</span>:' )
        .replace( /: (true)/g, ': <span class="value-bool-true">$1</span>' )
        .replace( /: (false)/g, ': <span class="value-bool-false">$1</span>' )
        .replace( /: (\d+)/g, ': <span class="value-number">$1</span>' )
        .replace( /: (\w+)$/gm, ( match, p1 ) => {
            if ( p1 === 'true' || p1 === 'false' || !isNaN( p1 ) ) {
                return match;
            }
            return `: <span class="value">${p1}</span>`;
        } );
}

// Show toast notification
function showToast( message, type = 'success' ) {
    toastMessage.textContent = message;
    toast.style.borderColor = type === 'warning' ? 'var(--warning)' : 'var(--success)';
    toast.querySelector( '.toast-icon' ).style.background = 
        type === 'warning' ? 'var(--warning)' : 'var(--success)';
    toast.classList.add( 'show' );
    
    setTimeout( () => {
        toast.classList.remove( 'show' );
    }, 2500 );
}

// Auto-generate on setting change
const allInputs = document.querySelectorAll( '.custom-options input, .custom-options select' );
allInputs.forEach( input => {
    input.addEventListener( 'change', () => {
        if ( !output.textContent.includes( 'Click "Generate"' ) ) {
            generateClangFormat();
        }
    } );
} );

// Initialize with sample code
document.addEventListener( 'DOMContentLoaded', () => {
    codeInput.value = `auto g_driver = std::make_unique< driver::c_driver >( );

int main( ) {
    if ( !g_driver->initialize( ) )
        return std::getchar( );

    auto process_id = g_driver->get_process_id( L"notepad.exe" );
    if ( !process_id )
        return std::getchar( );

    std::cout << "process_id: " << process_id << std::endl;

    return std::getchar( );
}`;
} );
