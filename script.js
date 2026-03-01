(function() {
    const $ = id => document.getElementById(id);

    const codeInput = $('codeInput');
    const output = $('output');
    const settingsList = $('settingsList');
    const customOptions = $('customOptions');
    const customToggle = $('customToggle');
    const toast = $('toast');
    const toastMessage = $('toastMessage');

    const sampleCode = `class RenderSystem {
private:
    std::vector< std::unique_ptr< Shader > > m_shaders;
    std::unordered_map< uint32_t, MeshData > m_meshCache;
    
public:
    RenderSystem( ) : m_isInitialized( false ) { }
    
    bool initialize( const RenderConfig& config ) {
        if ( !createDevice( config.width, config.height ) )
            return false;
            
        m_viewport = { 0, 0, config.width, config.height };
        m_isInitialized = true;
        return true;
    }
    
    void renderFrame( float deltaTime ) {
        for ( const auto& shader : m_shaders ) {
            if ( shader->isEnabled( ) ) {
                shader->bind( );
                drawBatches( shader.get( ) );
            }
        }
    }
    
    template< typename T >
    T* getShader( const std::string& name ) {
        auto it = std::find_if( m_shaders.begin( ), m_shaders.end( ),
            [ &name ]( const auto& s ) { return s->getName( ) == name; } );
            
        if ( it != m_shaders.end( ) )
            return static_cast< T* >( it->get( ) );
        return nullptr;
    }
    
private:
    bool m_isInitialized;
    Viewport m_viewport;
};`;

    const defaults = {
        IndentWidth: 2,
        TabWidth: 2,
        UseTab: 'Never',
        IndentCaseLabels: false,
        IndentPPDirectives: 'None',
        IndentGotoLabels: true,
        NamespaceIndentation: 'None',
        SpacesInParentheses: false,
        SpaceInEmptyParentheses: false,
        SpacesInAngles: 'Never',
        SpacesInSquareBrackets: false,
        SpaceAfterCStyleCast: false,
        SpaceBeforeAssignmentOperators: true,
        SpaceAfterLogicalNot: false,
        SpaceBeforeInheritanceColon: true,
        BreakBeforeBraces: 'Attach',
        SpaceBeforeParens: 'ControlStatements',
        PointerAlignment: 'Right',
        AlignConsecutiveAssignments: 'None',
        AlignConsecutiveDeclarations: 'None',
        AlignTrailingComments: true,
        AlignEscapedNewlines: 'Right',
        AlignOperands: 'Align',
        AlignArrayOfStructures: 'None',
        ColumnLimit: 80,
        MaxEmptyLinesToKeep: 1,
        ContinuationIndentWidth: 4,
        BinPackArguments: true,
        BinPackParameters: true,
        BreakBeforeBinaryOperators: 'None',
        BreakBeforeTernaryOperators: true,
        AllowShortFunctionsOnASingleLine: 'All',
        AllowShortIfStatementsOnASingleLine: 'Never',
        AllowShortLoopsOnASingleLine: false,
        AllowShortBlocksOnASingleLine: 'Never',
        AllowShortCaseLabelsOnASingleLine: false,
        AllowShortLambdasOnASingleLine: 'All',
        SortIncludes: 'CaseSensitive',
        SortUsingDeclarations: true,
        FixNamespaceComments: true,
        CompactNamespaces: false,
        IncludeBlocks: 'Preserve',
        AlwaysBreakTemplateDeclarations: 'MultiLine',
        InsertBraces: false,
        RemoveBracesLLVM: false,
        InsertTrailingCommas: 'None',
        Standard: 'Latest'
    };

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
        generate();
    });

    $('generateBtn').addEventListener('click', generate);

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
        var blob = new Blob([text], { type: 'text/plain' });
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

        if (/\(\s+\S/.test(code) && /\S\s+\)/.test(code)) {
            result.SpacesInParentheses = true;
        } else if (/\(\S/.test(code) && /\S\)/.test(code)) {
            result.SpacesInParentheses = false;
        }

        if (/\(\s+\)/.test(code)) {
            result.SpaceInEmptyParentheses = true;
        } else if (/\(\)/.test(code)) {
            result.SpaceInEmptyParentheses = false;
        }

        if (/<\s+\w/.test(code) && /\w\s+>/.test(code)) {
            result.SpacesInAngles = 'Always';
        } else if (/<\w/.test(code)) {
            result.SpacesInAngles = 'Never';
        }

        if (/\[\s+\w/.test(code) && /\w\s+\]/.test(code)) {
            result.SpacesInSquareBrackets = true;
        }

        if (/\)\s*\n\s*\{/.test(code)) {
            result.BreakBeforeBraces = 'Allman';
        } else if (/\)\s*\{/.test(code)) {
            result.BreakBeforeBraces = 'Attach';
        }

        var lines = code.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var match = lines[i].match(/^(\s+)\S/);
            if (match) {
                var ws = match[1];
                if (ws.indexOf('\t') !== -1) {
                    result.UseTab = 'Always';
                    result.IndentWidth = 4;
                } else {
                    result.UseTab = 'Never';
                    var len = ws.length;
                    if (len <= 8) result.IndentWidth = len;
                }
                break;
            }
        }

        if (/\b(if|for|while|switch)\s+\(/.test(code)) {
            result.SpaceBeforeParens = 'ControlStatements';
        } else if (/\b(if|for|while|switch)\(/.test(code)) {
            result.SpaceBeforeParens = 'Never';
        }

        if (/\w+\*\s+\w/.test(code) && !/\w\s+\*\w/.test(code)) {
            result.PointerAlignment = 'Left';
        } else if (/\w\s+\*\w/.test(code)) {
            result.PointerAlignment = 'Right';
        } else if (/\w\s+\*\s+\w/.test(code)) {
            result.PointerAlignment = 'Middle';
        }

        if (/template\s*<[^>]+>\s*\n/.test(code)) {
            result.AlwaysBreakTemplateDeclarations = 'Yes';
        }

        if (/!\s+\w/.test(code)) {
            result.SpaceAfterLogicalNot = true;
        }

        return result;
    }

    function applyToUI(p) {
        if (p.IndentWidth != null) $('optIndentWidth').value = p.IndentWidth;
        if (p.UseTab != null) $('optUseTabs').checked = (p.UseTab === 'Always');
        if (p.SpacesInParentheses != null) $('optSpaceParens').checked = p.SpacesInParentheses;
        if (p.SpaceInEmptyParentheses != null) $('optSpaceEmptyParens').checked = p.SpaceInEmptyParentheses;
        if (p.SpacesInAngles != null) $('optSpaceAngles').checked = (p.SpacesInAngles === 'Always');
        if (p.SpacesInSquareBrackets != null) $('optSpaceBrackets').checked = p.SpacesInSquareBrackets;
        if (p.BreakBeforeBraces != null) $('optBraceStyle').value = p.BreakBeforeBraces;
        if (p.SpaceBeforeParens != null) $('optSpaceBeforeParen').value = p.SpaceBeforeParens;
        if (p.PointerAlignment != null) $('optPointerAlign').value = p.PointerAlignment;
        if (p.AlwaysBreakTemplateDeclarations != null) $('optBreakTemplate').value = p.AlwaysBreakTemplateDeclarations;
        if (p.SpaceAfterLogicalNot != null) $('optSpaceAfterNot').checked = p.SpaceAfterLogicalNot;
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
            html += '<span class="setting-tag"><span class="tag-name">' + k + ':</span><span class="tag-value">' + p[k] + '</span></span>';
        }
        settingsList.innerHTML = html;
    }

    function readUI() {
        var indent = parseInt($('optIndentWidth').value) || 4;
        return {
            IndentWidth: indent,
            TabWidth: indent,
            UseTab: $('optUseTabs').checked ? 'Always' : 'Never',
            IndentCaseLabels: $('optIndentCase').checked,
            IndentPPDirectives: $('optIndentPP').checked ? 'BeforeHash' : 'None',
            IndentGotoLabels: $('optIndentGoto').checked,
            NamespaceIndentation: $('optNamespaceIndent').value,
            SpacesInParentheses: $('optSpaceParens').checked,
            SpaceInEmptyParentheses: $('optSpaceEmptyParens').checked,
            SpacesInAngles: $('optSpaceAngles').checked ? 'Always' : 'Never',
            SpacesInSquareBrackets: $('optSpaceBrackets').checked,
            SpaceAfterCStyleCast: $('optSpaceAfterCast').checked,
            SpaceBeforeAssignmentOperators: $('optSpaceBeforeAssign').checked,
            SpaceAfterLogicalNot: $('optSpaceAfterNot').checked,
            SpaceBeforeInheritanceColon: $('optSpaceBeforeColon').checked,
            BreakBeforeBraces: $('optBraceStyle').value,
            SpaceBeforeParens: $('optSpaceBeforeParen').value,
            PointerAlignment: $('optPointerAlign').value,
            AlignConsecutiveAssignments: $('optAlignAssign').checked ? 'Consecutive' : 'None',
            AlignConsecutiveDeclarations: $('optAlignDecl').checked ? 'Consecutive' : 'None',
            AlignTrailingComments: $('optAlignComments').checked,
            AlignEscapedNewlines: $('optAlignEscaped').value,
            AlignOperands: $('optAlignOperands').checked ? 'Align' : 'DontAlign',
            AlignArrayOfStructures: $('optAlignArray').value,
            ColumnLimit: parseInt($('optColumnLimit').value) || 0,
            MaxEmptyLinesToKeep: parseInt($('optMaxEmptyLines').value) || 1,
            ContinuationIndentWidth: parseInt($('optContinuationIndent').value) || 4,
            BinPackArguments: $('optBinPackArgs').checked,
            BinPackParameters: $('optBinPackParams').checked,
            BreakBeforeBinaryOperators: $('optBreakBeforeBinary').value,
            BreakBeforeTernaryOperators: $('optBreakTernary').checked,
            AllowShortFunctionsOnASingleLine: $('optShortFunctions').value,
            AllowShortIfStatementsOnASingleLine: $('optShortIf').value,
            AllowShortLoopsOnASingleLine: $('optShortLoops').checked,
            AllowShortBlocksOnASingleLine: $('optShortBlocks').checked ? 'Always' : 'Never',
            AllowShortCaseLabelsOnASingleLine: $('optShortCase').checked,
            AllowShortLambdasOnASingleLine: $('optShortLambdas').value,
            SortIncludes: $('optSortIncludes').checked ? 'CaseSensitive' : 'Never',
            SortUsingDeclarations: $('optSortUsing').checked,
            FixNamespaceComments: $('optFixNsComments').checked,
            CompactNamespaces: $('optCompactNs').checked,
            IncludeBlocks: $('optIncludeBlocks').value,
            AlwaysBreakTemplateDeclarations: $('optBreakTemplate').value,
            InsertBraces: $('optInsertBraces').checked,
            RemoveBracesLLVM: $('optRemoveBraces').checked,
            InsertTrailingCommas: $('optTrailingComma').value,
            Standard: $('optCppStandard').value
        };
    }

    function getChanged(settings) {
        var changed = {};
        for (var k in settings) {
            if (defaults.hasOwnProperty(k) && defaults[k] !== settings[k]) {
                changed[k] = settings[k];
            }
        }
        return changed;
    }

    function generate() {
        var settings = readUI();
        var changed = getChanged(settings);
        var keys = Object.keys(changed);

        if (!keys.length) {
            output.innerHTML = '<span class="comment"># Matches LLVM defaults</span>\nBasedOnStyle: LLVM';
            showToast('Generated!');
            return;
        }

        var text = '# .clang-format\n';
        text += '# Generated config (non-default values only)\n\n';
        text += 'BasedOnStyle: LLVM\n';
        text += 'Language: Cpp\n';

        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var v = changed[k];
            if (typeof v === 'boolean') {
                text += k + ': ' + (v ? 'true' : 'false') + '\n';
            } else if (typeof v === 'number') {
                text += k + ': ' + v + '\n';
            } else {
                text += k + ': ' + v + '\n';
            }
        }

        output.innerHTML = highlight(text);
        showToast('Generated!');
    }

    function highlight(text) {
        var lines = text.split('\n');
        var result = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.charAt(0) === '#') {
                result.push('<span class="comment">' + escapeHtml(line) + '</span>');
            } else if (line.indexOf(':') !== -1) {
                var parts = line.split(':');
                var key = parts[0];
                var val = parts.slice(1).join(':').trim();
                var valClass = 'value';
                if (val === 'true') valClass = 'value-true';
                else if (val === 'false') valClass = 'value-false';
                else if (/^\d+$/.test(val)) valClass = 'value-number';
                result.push('<span class="key">' + escapeHtml(key) + '</span>: <span class="' + valClass + '">' + escapeHtml(val) + '</span>');
            } else {
                result.push(escapeHtml(line));
            }
        }
        return result.join('\n');
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
