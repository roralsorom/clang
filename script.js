(function() {
    var $ = function(id) { return document.getElementById(id); };

    var codeInput = $('codeInput');
    var output = $('output');
    var settingsList = $('settingsList');
    var customOptions = $('customOptions');
    var customToggle = $('customToggle');
    var toast = $('toast');
    var toastMessage = $('toastMessage');

    var sampleCode = `#include <iostream>
#include <vector>
#include <memory>
#include <string>
#include <unordered_map>

class MemoryManager {
private:
    std::vector< std::unique_ptr< uint8_t[ ] > > m_buffers;
    std::unordered_map< uint64_t, size_t > m_allocations;
    bool m_initialized;

public:
    MemoryManager( ) : m_initialized( false ) { }

    bool initialize( size_t poolSize ) {
        if ( m_initialized )
            return false;

        m_buffers.reserve( poolSize );
        m_initialized = true;
        return true;
    }

    void* allocate( size_t size ) {
        if ( !m_initialized )
            return nullptr;

        auto buffer = std::make_unique< uint8_t[ ] >( size );
        void* ptr = buffer.get( );

        m_allocations[ reinterpret_cast< uint64_t >( ptr ) ] = size;
        m_buffers.push_back( std::move( buffer ) );

        return ptr;
    }

    template< typename T >
    T* read( uint64_t address ) {
        if ( !address )
            return nullptr;

        auto it = m_allocations.find( address );
        if ( it == m_allocations.end( ) )
            return nullptr;

        return reinterpret_cast< T* >( address );
    }

    template< typename T >
    bool write( uint64_t address, const T& value ) {
        if ( !address )
            return false;

        auto* ptr = read< T >( address );
        if ( !ptr )
            return false;

        *ptr = value;
        return true;
    }

    size_t getAllocationSize( void* ptr ) {
        auto it = m_allocations.find( reinterpret_cast< uint64_t >( ptr ) );
        if ( it != m_allocations.end( ) )
            return it->second;
        return 0;
    }

    void processBuffer( uint8_t* data, size_t length ) {
        for ( size_t i = 0; i < length; i++ ) {
            data[ i ] = static_cast< uint8_t >( data[ i ] ^ 0xFF );
        }
    }
};

int main( ) {
    auto manager = std::make_unique< MemoryManager >( );

    if ( !manager->initialize( 1024 ) )
        return 1;

    void* buffer = manager->allocate( sizeof( uint64_t ) );
    if ( !buffer )
        return 1;

    std::cout << "allocated: " << buffer << std::endl;
    std::cout << "size: " << manager->getAllocationSize( buffer ) << std::endl;

    uint64_t testValue = 0xDEADBEEF;
    if ( !manager->write( reinterpret_cast< uint64_t >( buffer ), testValue ) )
        return 1;

    auto* readValue = manager->read< uint64_t >( reinterpret_cast< uint64_t >( buffer ) );
    if ( !readValue )
        return 1;

    std::cout << "value: 0x" << std::hex << *readValue << std::endl;

    return 0;
}`;

    codeInput.value = sampleCode;

    customToggle.addEventListener('click', function() {
        customOptions.classList.toggle('open');
        this.querySelector('.toggle-icon').classList.toggle('rotated');
    });

    $('clearBtn').addEventListener('click', function() {
        codeInput.value = '';
        codeInput.focus();
    });

    $('analyzeBtn').addEventListener('click', function() {
        var code = codeInput.value.trim();
        if (!code) {
            showToast('Enter some code first');
            return;
        }
        var patterns = analyzeCode(code);
        applyToUI(patterns);
        showPatterns(patterns);
        generateFromPatterns(patterns);
    });

    $('generateBtn').addEventListener('click', function() {
        generate();
    });

    $('copyBtn').addEventListener('click', function() {
        var text = output.textContent;
        if (text.indexOf('Click') !== -1) {
            showToast('Generate config first');
            return;
        }
        navigator.clipboard.writeText(text);
        showToast('Copied!');
    });

    $('downloadBtn').addEventListener('click', function() {
        var text = output.textContent;
        if (text.indexOf('Click') !== -1) {
            showToast('Generate config first');
            return;
        }
        var blob = new Blob([text], { type: 'application/octet-stream' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = '.clang-format';
        a.click();
        URL.revokeObjectURL(url);

        showToast('Downloaded!');
    });

    var configInputs = customOptions.querySelectorAll('input, select');
    for (var i = 0; i < configInputs.length; i++) {
        configInputs[i].addEventListener('change', function() {
            if (output.textContent.indexOf('Click') === -1) {
                generate();
            }
        });
    }

    function analyzeCode(code) {
        var result = {};
        
        // Indentation - find first indented line
        var lines = code.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var m = lines[i].match(/^(\s+)\S/);
            if (m) {
                var ws = m[1];
                if (ws.indexOf('\t') !== -1) {
                    result.UseTab = true;
                    result.IndentWidth = 4;
                } else {
                    result.UseTab = false;
                    result.IndentWidth = ws.length;
                }
                break;
            }
        }

        // Spaces in parentheses: func( x ) vs func(x)
        // Look for pattern: ( followed by space and non-space, and non-space followed by space and )
        var spacedParens = /\(\s+[^\s\)]/.test(code) && /[^\s\(]\s+\)/.test(code);
        var tightParens = /\([^\s]/.test(code) && /[^\s]\)/.test(code);
        
        // Count occurrences to determine dominant style
        var spacedCount = (code.match(/\(\s+\S/g) || []).length;
        var tightCount = (code.match(/\(\S/g) || []).length;
        
        if (spacedCount > tightCount * 0.5) {
            result.SpacesInParentheses = true;
        }

        // Space in empty parentheses: func( ) vs func()
        if (/\(\s+\)/.test(code)) {
            result.SpaceInEmptyParentheses = true;
        }

        // Spaces in angle brackets: < type > vs <type>
        // Check templates like std::make_unique< type >
        var spacedAngles = /<\s+\w/.test(code) || /\w\s+>/.test(code);
        var tightAngles = /<\w/.test(code) && /\w>/.test(code);
        
        // Look specifically for template patterns with spaces
        var templateWithSpaces = /\w+<\s+[\w:]+\s*>/.test(code) || /static_cast<\s+\w+\s*>/.test(code);
        
        if (spacedAngles || templateWithSpaces) {
            result.SpacesInAngles = true;
        }

        // Spaces in square brackets: arr[ i ] vs arr[i]
        if (/\[\s+\w/.test(code) && /\w\s+\]/.test(code)) {
            result.SpacesInSquareBrackets = true;
        }

        // Brace style - check if { is on same line as )
        if (/\)\s*\{/.test(code)) {
            result.BreakBeforeBraces = 'Attach';
        } else if (/\)\s*\n\s*\{/.test(code)) {
            result.BreakBeforeBraces = 'Allman';
        }

        // Space before parens - THE KEY DETECTION
        // Pattern: if ( ... ) has space, but func( ) has no space before (
        var controlWithSpace = /\b(if|for|while|switch)\s+\(/.test(code);
        var controlNoSpace = /\b(if|for|while|switch)\(/.test(code);
        
        // Check function calls - they should NOT have space before (
        // Pattern: identifier( without space = func call style
        var funcCallPattern = /[a-zA-Z_]\w*\(/g;
        var funcCalls = code.match(funcCallPattern) || [];
        
        // Filter out control statements
        var pureFuncCalls = funcCalls.filter(function(call) {
            return !/(if|for|while|switch|return)\(/.test(call);
        });
        
        // Check if function DEFINITIONS have space before (
        // Pattern: type func ( ) or func ( ) {
        var funcDefWithSpace = /\w+\s+\([\s\)]*\)\s*[:{]/.test(code);
        var funcDefNoSpace = /\w+\([\s\)]*\)\s*[:{]/.test(code);
        
        if (controlWithSpace && !controlNoSpace) {
            // Control statements have space
            if (pureFuncCalls.length > 0) {
                // Function calls exist without space before (
                // This is the custom style: if ( ) but func( )
                result.SpaceBeforeParens = 'Custom';
                result.SpaceBeforeParensOptions = {
                    AfterControlStatements: true,
                    AfterFunctionDefinitionName: false,
                    AfterFunctionDeclarationName: false,
                    AfterIfMacros: true,
                    AfterOverloadedOperator: false,
                    BeforeNonEmptyParentheses: false
                };
            } else {
                result.SpaceBeforeParens = 'ControlStatements';
            }
        } else if (controlNoSpace && !controlWithSpace) {
            result.SpaceBeforeParens = 'Never';
        }

        // Pointer alignment: int* x vs int *x
        if (/[a-zA-Z_]\w*\*\s+\w/.test(code)) {
            result.PointerAlignment = 'Left';
        } else if (/\w\s+\*[a-zA-Z_]/.test(code)) {
            result.PointerAlignment = 'Right';
        }

        // Column limit - check max line length
        var maxLen = 0;
        for (var j = 0; j < lines.length; j++) {
            if (lines[j].length > maxLen) maxLen = lines[j].length;
        }
        if (maxLen > 80) {
            result.ColumnLimit = 0;
        }

        // Short if statements - check for multi-line if without braces
        // Pattern: if ( ... )\n    statement;
        if (/\bif\s*\([^)]+\)\s*\n\s+\w/.test(code)) {
            result.AllowShortIfStatementsOnASingleLine = 'Never';
        }

        // Short blocks - check for empty blocks { }
        if (/\{\s*\}/.test(code)) {
            result.AllowShortBlocksOnASingleLine = 'Empty';
        } else {
            result.AllowShortBlocksOnASingleLine = 'Never';
        }

        // Short loops
        if (/\b(for|while)\s*\([^)]+\)\s*\n/.test(code)) {
            result.AllowShortLoopsOnASingleLine = false;
        }

        // Short functions - check if functions span multiple lines
        if (/\)\s*\{\s*\n/.test(code)) {
            result.AllowShortFunctionsOnASingleLine = 'None';
        }

        return result;
    }

    function applyToUI(p) {
        if (p.IndentWidth) $('optIndentWidth').value = p.IndentWidth;
        if (p.UseTab !== undefined) $('optUseTabs').checked = p.UseTab;
        if (p.SpacesInParentheses !== undefined) $('optSpaceParens').checked = p.SpacesInParentheses;
        if (p.SpaceInEmptyParentheses !== undefined) $('optSpaceEmptyParens').checked = p.SpaceInEmptyParentheses;
        if (p.SpacesInAngles !== undefined) $('optSpaceAngles').checked = p.SpacesInAngles;
        if (p.SpacesInSquareBrackets !== undefined) $('optSpaceBrackets').checked = p.SpacesInSquareBrackets;
        if (p.BreakBeforeBraces) $('optBraceStyle').value = p.BreakBeforeBraces;
        if (p.SpaceBeforeParens && p.SpaceBeforeParens !== 'Custom') {
            $('optSpaceBeforeParen').value = p.SpaceBeforeParens;
        }
        if (p.PointerAlignment) $('optPointerAlign').value = p.PointerAlignment;
        if (p.AllowShortFunctionsOnASingleLine) $('optShortFunctions').value = p.AllowShortFunctionsOnASingleLine;
        if (p.AllowShortIfStatementsOnASingleLine) $('optShortIf').value = p.AllowShortIfStatementsOnASingleLine;
        if (p.AllowShortLoopsOnASingleLine !== undefined) $('optShortLoops').checked = p.AllowShortLoopsOnASingleLine;
        if (p.ColumnLimit !== undefined) $('optColumnLimit').value = p.ColumnLimit;
    }

    function showPatterns(p) {
        var keys = Object.keys(p);
        if (!keys.length) {
            settingsList.innerHTML = '<p class="no-settings">No patterns detected</p>';
            return;
        }
        var html = '';
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var v = p[k];
            if (typeof v === 'object') {
                v = 'Custom {...}';
            }
            html += '<span class="setting-tag"><span class="tag-name">' + k + ':</span><span class="tag-value">' + v + '</span></span>';
        }
        settingsList.innerHTML = html;
    }

    function generateFromPatterns(patterns) {
        var text = '';
        text += 'BasedOnStyle: LLVM\n';
        text += 'Language: Cpp\n';
        
        // Indentation
        if (patterns.IndentWidth) {
            text += 'IndentWidth: ' + patterns.IndentWidth + '\n';
            text += 'TabWidth: ' + patterns.IndentWidth + '\n';
        }
        if (patterns.UseTab !== undefined) {
            text += 'UseTab: ' + (patterns.UseTab ? 'Always' : 'Never') + '\n';
        }
        
        text += '\n';
        
        // Braces
        if (patterns.BreakBeforeBraces) {
            text += '# Braces\n';
            text += 'BreakBeforeBraces: ' + patterns.BreakBeforeBraces + '\n';
            text += '\n';
        }
        
        // Spacing
        var hasSpacing = patterns.SpacesInParentheses || patterns.SpaceInEmptyParentheses || 
                         patterns.SpacesInAngles || patterns.SpacesInSquareBrackets;
        if (hasSpacing) {
            text += '# Spaces in brackets\n';
            if (patterns.SpacesInParentheses) text += 'SpacesInParentheses: true\n';
            if (patterns.SpaceInEmptyParentheses) text += 'SpaceInEmptyParentheses: true\n';
            if (patterns.SpacesInAngles) text += 'SpacesInAngles: true\n';
            if (patterns.SpacesInSquareBrackets) text += 'SpacesInSquareBrackets: true\n';
            text += '\n';
        }
        
        // Space before parens - THE CUSTOM BLOCK
        if (patterns.SpaceBeforeParens === 'Custom' && patterns.SpaceBeforeParensOptions) {
            text += '# Space BEFORE opening paren - this is the key change\n';
            text += 'SpaceBeforeParens: Custom\n';
            text += 'SpaceBeforeParensOptions:\n';
            text += '  AfterControlStatements: true          # if ( ) ✓\n';
            text += '  AfterFunctionDefinitionName: false    # void func( ) not void func ( )\n';
            text += '  AfterFunctionDeclarationName: false   # void func( ); not void func ( );\n';
            text += '  AfterIfMacros: true\n';
            text += '  AfterOverloadedOperator: false\n';
            text += '  BeforeNonEmptyParentheses: false\n';
            text += '\n';
        } else if (patterns.SpaceBeforeParens && patterns.SpaceBeforeParens !== 'ControlStatements') {
            text += 'SpaceBeforeParens: ' + patterns.SpaceBeforeParens + '\n';
        }
        
        // Other settings
        var hasOther = patterns.PointerAlignment || patterns.ColumnLimit !== undefined ||
                       patterns.AllowShortIfStatementsOnASingleLine || 
                       patterns.AllowShortBlocksOnASingleLine ||
                       patterns.AllowShortLoopsOnASingleLine !== undefined ||
                       patterns.AllowShortFunctionsOnASingleLine;
        
        if (hasOther) {
            text += '# Other settings\n';
            if (patterns.PointerAlignment) text += 'PointerAlignment: ' + patterns.PointerAlignment + '\n';
            if (patterns.ColumnLimit !== undefined) text += 'ColumnLimit: ' + patterns.ColumnLimit + '\n';
            if (patterns.AllowShortIfStatementsOnASingleLine) {
                text += 'AllowShortIfStatementsOnASingleLine: ' + patterns.AllowShortIfStatementsOnASingleLine + '\n';
            }
            if (patterns.AllowShortBlocksOnASingleLine) {
                text += 'AllowShortBlocksOnASingleLine: ' + patterns.AllowShortBlocksOnASingleLine + '\n';
            }
            if (patterns.AllowShortLoopsOnASingleLine !== undefined) {
                text += 'AllowShortLoopsOnASingleLine: ' + patterns.AllowShortLoopsOnASingleLine + '\n';
            }
            if (patterns.AllowShortFunctionsOnASingleLine) {
                text += 'AllowShortFunctionsOnASingleLine: ' + patterns.AllowShortFunctionsOnASingleLine + '\n';
            }
        }
        
        output.innerHTML = highlight(text);
        showToast('Generated!');
    }

    function generate() {
        var code = codeInput.value.trim();
        if (code) {
            var patterns = analyzeCode(code);
            generateFromPatterns(patterns);
        } else {
            generateFromUI();
        }
    }

    function generateFromUI() {
        var indent = parseInt($('optIndentWidth').value) || 4;
        
        var text = '';
        text += 'BasedOnStyle: LLVM\n';
        text += 'Language: Cpp\n';
        text += 'IndentWidth: ' + indent + '\n';
        text += 'TabWidth: ' + indent + '\n';
        text += 'UseTab: ' + ($('optUseTabs').checked ? 'Always' : 'Never') + '\n';
        text += '\n';
        
        text += '# Braces\n';
        text += 'BreakBeforeBraces: ' + $('optBraceStyle').value + '\n';
        text += '\n';
        
        var spacesInParens = $('optSpaceParens').checked;
        var spaceInEmpty = $('optSpaceEmptyParens').checked;
        var spacesInAngles = $('optSpaceAngles').checked;
        var spacesInBrackets = $('optSpaceBrackets').checked;
        
        if (spacesInParens || spaceInEmpty || spacesInAngles || spacesInBrackets) {
            text += '# Spaces in brackets\n';
            if (spacesInParens) text += 'SpacesInParentheses: true\n';
            if (spaceInEmpty) text += 'SpaceInEmptyParentheses: true\n';
            if (spacesInAngles) text += 'SpacesInAngles: true\n';
            if (spacesInBrackets) text += 'SpacesInSquareBrackets: true\n';
            text += '\n';
        }
        
        var spaceBeforeParen = $('optSpaceBeforeParen').value;
        if (spaceBeforeParen !== 'ControlStatements') {
            text += 'SpaceBeforeParens: ' + spaceBeforeParen + '\n';
        }
        
        text += '# Other settings\n';
        text += 'PointerAlignment: ' + $('optPointerAlign').value + '\n';
        
        var colLimit = parseInt($('optColumnLimit').value);
        if (colLimit !== 80) {
            text += 'ColumnLimit: ' + colLimit + '\n';
        }
        
        var shortFuncs = $('optShortFunctions').value;
        if (shortFuncs !== 'All') {
            text += 'AllowShortFunctionsOnASingleLine: ' + shortFuncs + '\n';
        }
        
        var shortIf = $('optShortIf').value;
        if (shortIf !== 'Never') {
            text += 'AllowShortIfStatementsOnASingleLine: ' + shortIf + '\n';
        }
        
        if ($('optShortLoops').checked) {
            text += 'AllowShortLoopsOnASingleLine: true\n';
        }
        
        if ($('optShortBlocks').checked) {
            text += 'AllowShortBlocksOnASingleLine: Always\n';
        }
        
        output.innerHTML = highlight(text);
        showToast('Generated!');
    }

    function highlight(text) {
        var lines = text.split('\n');
        var result = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.trim() === '') {
                result.push('');
            } else if (line.charAt(0) === '#') {
                result.push('<span class="comment">' + escapeHtml(line) + '</span>');
            } else if (line.match(/^\s+\w/)) {
                // Indented lines (YAML nested)
                var parts = line.split(':');
                if (parts.length >= 2) {
                    var key = parts[0];
                    var val = parts.slice(1).join(':').trim();
                    // Check if there's a comment
                    var commentIdx = val.indexOf('#');
                    if (commentIdx !== -1) {
                        var valPart = val.substring(0, commentIdx).trim();
                        var cmtPart = val.substring(commentIdx);
                        result.push('<span class="key">' + escapeHtml(key) + '</span>: <span class="' + getValClass(valPart) + '">' + escapeHtml(valPart) + '</span> <span class="comment">' + escapeHtml(cmtPart) + '</span>');
                    } else {
                        result.push('<span class="key">' + escapeHtml(key) + '</span>: <span class="' + getValClass(val) + '">' + escapeHtml(val) + '</span>');
                    }
                } else {
                    result.push(escapeHtml(line));
                }
            } else if (line.indexOf(':') !== -1) {
                var colonIdx = line.indexOf(':');
                var key = line.substring(0, colonIdx);
                var val = line.substring(colonIdx + 1).trim();
                
                if (val === '') {
                    // Key only (like SpaceBeforeParensOptions:)
                    result.push('<span class="key">' + escapeHtml(key) + '</span>:');
                } else {
                    result.push('<span class="key">' + escapeHtml(key) + '</span>: <span class="' + getValClass(val) + '">' + escapeHtml(val) + '</span>');
                }
            } else {
                result.push(escapeHtml(line));
            }
        }
        return result.join('\n');
    }

    function getValClass(val) {
        if (val === 'true') return 'value-true';
        if (val === 'false') return 'value-false';
        if (/^\d+$/.test(val)) return 'value-number';
        return 'value';
    }

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function showToast(msg) {
        toastMessage.textContent = msg;
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
        }, 2000);
    }
})();
