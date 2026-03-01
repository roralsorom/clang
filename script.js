(function() {
    'use strict';

    // elements
    const $ = id => document.getElementById(id);
    
    const codeInput = $('codeInput');
    const output = $('output');
    const detectedTags = $('detectedTags');
    const configPanel = $('configPanel');
    const configToggle = $('configToggle');
    const toast = $('toast');

    // sample code
    const sampleCode = `class EntityManager {
public:
    void update( float deltaTime ) {
        for ( auto& entity : m_entities ) {
            if ( entity->isActive( ) ) {
                entity->tick( deltaTime );
            }
        }
    }

    Entity* spawn( const std::string& name, const Vec3& position ) {
        auto entity = std::make_unique< Entity >( name );
        entity->setPosition( position );
        m_entities.push_back( std::move( entity ) );
        return m_entities.back( ).get( );
    }

    template< typename T >
    T* findComponent( uint32_t entityId ) {
        if ( auto it = m_components.find( entityId ); it != m_components.end( ) ) {
            return static_cast< T* >( it->second.get( ) );
        }
        return nullptr;
    }

private:
    std::vector< std::unique_ptr< Entity > > m_entities;
    std::unordered_map< uint32_t, std::unique_ptr< Component > > m_components;
};`;

    // llvm defaults (what we compare against)
    const defaults = {
        IndentWidth: 2,
        UseTab: 'Never',
        IndentCaseLabels: false,
        IndentPPDirectives: 'None',
        SpacesInParentheses: false,
        SpaceInEmptyParentheses: false,
        SpacesInAngles: 'Never',
        SpacesInSquareBrackets: false,
        SpaceAfterCStyleCast: false,
        SpaceBeforeAssignmentOperators: true,
        BreakBeforeBraces: 'Attach',
        SpaceBeforeParens: 'ControlStatements',
        PointerAlignment: 'Right',
        AlignConsecutiveAssignments: 'None',
        AlignConsecutiveDeclarations: 'None',
        AlignTrailingComments: true,
        ColumnLimit: 80,
        MaxEmptyLinesToKeep: 1,
        BinPackArguments: true,
        BinPackParameters: true,
        AllowShortFunctionsOnASingleLine: 'All',
        AllowShortIfStatementsOnASingleLine: 'Never',
        AllowShortLoopsOnASingleLine: false,
        AllowShortBlocksOnASingleLine: 'Never',
        SortIncludes: 'CaseSensitive',
        FixNamespaceComments: true,
        CompactNamespaces: false,
        AlwaysBreakTemplateDeclarations: 'MultiLine'
    };

    // init
    codeInput.value = sampleCode;

    // toggle config panel
    configToggle.onclick = () => {
        configToggle.classList.toggle('open');
        configPanel.classList.toggle('show');
    };

    // clear button
    $('clearBtn').onclick = () => {
        codeInput.value = '';
        codeInput.focus();
    };

    // analyze
    $('analyzeBtn').onclick = () => {
        const code = codeInput.value.trim();
        if (!code) {
            notify('paste some code first');
            return;
        }
        const detected = analyze(code);
        applyDetected(detected);
        showDetected(detected);
        generate();
    };

    // generate
    $('generateBtn').onclick = generate;

    // copy
    $('copyBtn').onclick = () => {
        const txt = output.textContent;
        if (txt.includes('paste code')) {
            notify('generate something first');
            return;
        }
        navigator.clipboard.writeText(txt);
        notify('copied!');
    };

    // download
    $('downloadBtn').onclick = () => {
        const txt = output.textContent;
        if (txt.includes('paste code')) {
            notify('generate something first');
            return;
        }
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '.clang-format';
        a.click();
        URL.revokeObjectURL(url);
        notify('downloaded!');
    };

    // auto-regen on config change
    configPanel.querySelectorAll('input, select').forEach(el => {
        el.onchange = () => {
            if (!output.textContent.includes('paste code')) {
                generate();
            }
        };
    });

    // analyze code patterns
    function analyze(code) {
        const r = {};

        // spaces in parens: ( x ) vs (x)
        if (/\(\s+\S/.test(code) && /\S\s+\)/.test(code)) {
            r.SpacesInParentheses = true;
        } else if (/\(\S/.test(code) || /\S\)/.test(code)) {
            r.SpacesInParentheses = false;
        }

        // empty parens: ( ) vs ()
        if (/\(\s+\)/.test(code)) {
            r.SpaceInEmptyParentheses = true;
        } else if (/\(\)/.test(code)) {
            r.SpaceInEmptyParentheses = false;
        }

        // angle brackets: < T > vs <T>
        if (/<\s+\w/.test(code) && /\w\s+>/.test(code)) {
            r.SpacesInAngles = 'Always';
        } else if (/<\w/.test(code)) {
            r.SpacesInAngles = 'Never';
        }

        // square brackets
        if (/\[\s+\w/.test(code)) {
            r.SpacesInSquareBrackets = true;
        }

        // brace style
        if (/\)\s*\n\s*\{/.test(code)) {
            r.BreakBeforeBraces = 'Allman';
        } else if (/\)\s*\{/.test(code)) {
            r.BreakBeforeBraces = 'Attach';
        }

        // indentation
        const lines = code.split('\n');
        for (const line of lines) {
            const m = line.match(/^(\s+)\S/);
            if (m) {
                const ws = m[1];
                if (ws.includes('\t')) {
                    r.UseTab = 'Always';
                    r.IndentWidth = 4;
                } else {
                    r.UseTab = 'Never';
                    r.IndentWidth = ws.length;
                    if (r.IndentWidth > 8) r.IndentWidth = 4; // probably continuation
                }
                break;
            }
        }

        // space before paren: if ( vs if(
        const hasSpaceControl = /\b(if|for|while|switch)\s+\(/.test(code);
        const noSpaceControl = /\b(if|for|while|switch)\(/.test(code);
        if (hasSpaceControl && !noSpaceControl) {
            r.SpaceBeforeParens = 'ControlStatements';
        } else if (noSpaceControl) {
            r.SpaceBeforeParens = 'Never';
        }

        // pointer align
        if (/\w+\*\s+\w/.test(code) && !/\w\s+\*\w/.test(code)) {
            r.PointerAlignment = 'Left';
        } else if (/\w\s+\*\w/.test(code)) {
            r.PointerAlignment = 'Right';
        }

        // template
        if (/template\s*<[^>]+>\s*\n/.test(code)) {
            r.AlwaysBreakTemplateDeclarations = 'Yes';
        }

        return r;
    }

    // apply detected settings to UI
    function applyDetected(d) {
        if (d.IndentWidth != null) $('optIndentWidth').value = d.IndentWidth;
        if (d.UseTab != null) $('optUseTabs').checked = d.UseTab === 'Always';
        if (d.SpacesInParentheses != null) $('optSpaceParens').checked = d.SpacesInParentheses;
        if (d.SpaceInEmptyParentheses != null) $('optSpaceEmptyParens').checked = d.SpaceInEmptyParentheses;
        if (d.SpacesInAngles != null) $('optSpaceAngles').checked = d.SpacesInAngles === 'Always';
        if (d.SpacesInSquareBrackets != null) $('optSpaceBrackets').checked = d.SpacesInSquareBrackets;
        if (d.BreakBeforeBraces != null) $('optBraceStyle').value = d.BreakBeforeBraces;
        if (d.SpaceBeforeParens != null) $('optSpaceBeforeParen').value = d.SpaceBeforeParens;
        if (d.PointerAlignment != null) $('optPointerAlign').value = d.PointerAlignment;
        if (d.AlwaysBreakTemplateDeclarations != null) $('optBreakTemplate').value = d.AlwaysBreakTemplateDeclarations;
    }

    // show detected as tags
    function showDetected(d) {
        const keys = Object.keys(d);
        if (!keys.length) {
            detectedTags.innerHTML = '<span class="muted">no patterns found</span>';
            return;
        }
        detectedTags.innerHTML = keys.map(k => 
            `<span class="tag"><span class="tag-k">${k}:</span><span class="tag-v">${d[k]}</span></span>`
        ).join('');
    }

    // read current settings from UI
    function readSettings() {
        const indent = parseInt($('optIndentWidth').value) || 4;
        return {
            IndentWidth: indent,
            TabWidth: indent,
            UseTab: $('optUseTabs').checked ? 'Always' : 'Never',
            IndentCaseLabels: $('optIndentCase').checked,
            IndentPPDirectives: $('optIndentPP').checked ? 'BeforeHash' : 'None',
            SpacesInParentheses: $('optSpaceParens').checked,
            SpaceInEmptyParentheses: $('optSpaceEmptyParens').checked,
            SpacesInAngles: $('optSpaceAngles').checked ? 'Always' : 'Never',
            SpacesInSquareBrackets: $('optSpaceBrackets').checked,
            SpaceAfterCStyleCast: $('optSpaceAfterCast').checked,
            SpaceBeforeAssignmentOperators: $('optSpaceBeforeAssign').checked,
            BreakBeforeBraces: $('optBraceStyle').value,
            SpaceBeforeParens: $('optSpaceBeforeParen').value,
            PointerAlignment: $('optPointerAlign').value,
            AlignConsecutiveAssignments: $('optAlignAssign').checked ? 'Consecutive' : 'None',
            AlignConsecutiveDeclarations: $('optAlignDecl').checked ? 'Consecutive' : 'None',
            AlignTrailingComments: $('optAlignComments').checked,
            ColumnLimit: parseInt($('optColumnLimit').value) || 0,
            MaxEmptyLinesToKeep: parseInt($('optMaxEmptyLines').value) || 1,
            BinPackArguments: $('optBinPackArgs').checked,
            BinPackParameters: $('optBinPackParams').checked,
            AllowShortFunctionsOnASingleLine: $('optShortFunctions').value,
            AllowShortIfStatementsOnASingleLine: $('optShortIf').value,
            AllowShortLoopsOnASingleLine: $('optShortLoops').checked,
            AllowShortBlocksOnASingleLine: $('optShortBlocks').checked ? 'Always' : 'Never',
            SortIncludes: $('optSortIncludes').checked ? 'CaseSensitive' : 'Never',
            FixNamespaceComments: $('optFixNsComments').checked,
            CompactNamespaces: $('optCompactNs').checked,
            AlwaysBreakTemplateDeclarations: $('optBreakTemplate').value
        };
    }

    // get only changed settings
    function getChanged(settings) {
        const changed = {};
        for (const [k, v] of Object.entries(settings)) {
            if (defaults[k] !== v) {
                changed[k] = v;
            }
        }
        return changed;
    }

    // generate output
    function generate() {
        const settings = readSettings();
        const changed = getChanged(settings);
        const keys = Object.keys(changed);

        if (!keys.length) {
            output.innerHTML = '<span class="cmt"># identical to LLVM defaults</span>\nBasedOnStyle: LLVM';
            return;
        }

        let out = '';
        out += '# .clang-format\n';
        out += '# generated - only non-default values\n\n';
        out += 'BasedOnStyle: LLVM\n';
        out += 'Language: Cpp\n';

        // group by category for cleaner output
        const groups = {
            indent: ['IndentWidth', 'TabWidth', 'UseTab', 'IndentCaseLabels', 'IndentPPDirectives'],
            spacing: ['SpacesInParentheses', 'SpaceInEmptyParentheses', 'SpacesInAngles', 
                     'SpacesInSquareBrackets', 'SpaceAfterCStyleCast', 'SpaceBeforeAssignmentOperators'],
            braces: ['BreakBeforeBraces', 'SpaceBeforeParens'],
            align: ['PointerAlignment', 'AlignConsecutiveAssignments', 'AlignConsecutiveDeclarations', 'AlignTrailingComments'],
            lines: ['ColumnLimit', 'MaxEmptyLinesToKeep', 'BinPackArguments', 'BinPackParameters'],
            short: ['AllowShortFunctionsOnASingleLine', 'AllowShortIfStatementsOnASingleLine', 
                   'AllowShortLoopsOnASingleLine', 'AllowShortBlocksOnASingleLine'],
            other: ['SortIncludes', 'FixNamespaceComments', 'CompactNamespaces', 'AlwaysBreakTemplateDeclarations']
        };

        for (const [group, groupKeys] of Object.entries(groups)) {
            const has = groupKeys.filter(k => changed[k] !== undefined);
            if (has.length) {
                out += '\n';
                for (const k of has) {
                    out += `${k}: ${formatVal(changed[k])}\n`;
                }
            }
        }

        output.innerHTML = highlight(out);
        notify('done');
    }

    // format value for yaml
    function formatVal(v) {
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        if (typeof v === 'number') return v.toString();
        return v;
    }

    // syntax highlight
    function highlight(s) {
        return s
            .replace(/(#[^\n]*)/g, '<span class="cmt">$1</span>')
            .replace(/^(\w+):/gm, '<span class="key">$1</span>:')
            .replace(/: (true)$/gm, ': <span class="bool-t">$1</span>')
            .replace(/: (false)$/gm, ': <span class="bool-f">$1</span>')
            .replace(/: (\d+)$/gm, ': <span class="num">$1</span>')
            .replace(/: ([A-Za-z]+)$/gm, (m, p) => {
                if (p === 'true' || p === 'false') return m;
                return `: <span class="str">${p}</span>`;
            });
    }

    // toast notification
    function notify(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1800);
    }

})();
