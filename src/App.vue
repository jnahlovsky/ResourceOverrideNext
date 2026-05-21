<template>
  <div id="vue-root">
    <AppHeader />
    
    <div v-show="!showAddRuleForm" class="main-view">
      <div class="tabs-container">
        <div 
          class="tab" 
          :class="{ active: activeTab === 'redirects' }"
          @click="activeTab = 'redirects'"
        >
          URL Redirects
        </div>
        <div 
          class="tab" 
          :class="{ active: activeTab === 'headers' }"
          @click="activeTab = 'headers'"
        >
          Headers
        </div>
        <div 
          class="tab" 
          :class="{ active: activeTab === 'injections' }"
          @click="activeTab = 'injections'"
        >
          CSS/JS Injection
        </div>
      </div>

      <!-- Scrollable content area -->
      <div class="scrollable-content">
        <div class="tab-content-header">
          <h2 v-if="activeTab === 'redirects'">URL Redirects</h2>
          <p v-if="activeTab === 'redirects'">Configure URLs to be redirected to different destinations.</p>
          
          <h2 v-if="activeTab === 'headers'">Headers</h2>
          <p v-if="activeTab === 'headers'">Modify request and response headers.</p>

          <h2 v-if="activeTab === 'injections'">CSS/JS Injection</h2>
          <p v-if="activeTab === 'injections'">Inject custom CSS or JavaScript into pages or files.</p>
        </div>

        <!-- legacy-ui-container will receive a class based on activeTab -->
        <div id="legacy-ui-container" :class="'tab-' + activeTab" v-pre>
        <template id="onOffSwitchTemplate">
            <div class="onoffswitch">
                <input type="checkbox" class="onoffswitch-checkbox" checked>
                <label class="onoffswitch-label">
                    <span class="onoffswitch-inner">
                        <div class="onoffswitch-on">ON</div>
                        <div class="onoffswitch-off">OFF</div>
                    </span>
                    <span class="onoffswitch-switch"></span>
                </label>
            </div>
        </template>

        <template id="domainTemplate">
            <div class="domainContainer">
                <div class="domainHeader">
                    <div class="domainText">Tab URL:</div>
                    <div class="domain">
                        <input type="input" class="domainMatchInput" placeholder="Tab Match URL">
                    </div>
                    <div class="addRule">
                        <button class="btn addRuleBtn">Add Rule</button>
                    </div>
                    <div class="switch"></div>
                    <div class="delete">
                        <button class="deleteBtn btn sym-btn">&#215</button>
                    </div>
                </div>
                <div class="overrideRules"></div>
            </div>
        </template>

        <template id="overrideTemplate">
            <div class="ruleContainer normalOverride">
                <div class="rule-header">
                    <div class="handle">
                        <div class="arrow-up"></div><div class="arrow-down"></div>
                    </div>
                    <div class="switch"></div>
                    <div class="delete">
                        <button class="btn sym-btn">&#215</button>
                    </div>
                </div>
                <div class="rule-body">
                    <div>
                        <label>Source URL Pattern (Can be a URL substring or regex enclosed in /.../)</label>
                        <div class="rule">
                            <input type="input" class="matchInput" placeholder="Match URL">
                        </div>
                    </div>
                    <div>
                        <label>Destination URL</label>
                        <div class="rule">
                            <input type="input" class="replaceInput" placeholder="Replace URL">
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <template id="fileOverrideTemplate">
            <div class="ruleContainer fileOverride">
                <div class="handle">
                    <div class="arrow-up"></div><div class="arrow-down"></div>
                </div>
                <div class="match">From:</div>
                <div class="rule">
                    <input type="input" class="matchInput" placeholder="Match URL">
                </div>
                <div class="arrow">To:</div>
                <div class="edit">
                    <button class="btn edit-btn">Edit File</button>
                </div>
                <div class="switch"></div>
                <div class="delete">
                    <button class="btn sym-btn">&#215</button>
                </div>
            </div>
        </template>

        <template id="fileInjectTemplate">
            <div class="ruleContainer fileInject">
                <div class="handle">
                    <div class="arrow-up"></div><div class="arrow-down"></div>
                </div>
                <div class="match">Name:</div>
                <div class="rule">
                    <input type="input" class="fileName" placeholder="File Name (Optional)">
                </div>
                <div class="typeText">File Type:</div>
                <div class="fileType">
                    <select class="fileTypeSelect">
                        <option value="js">JS</option>
                        <option value="css">CSS</option>
                    </select>
                </div>
                <div class="injectText">Inject into:</div>
                <div class="injectLocation">
                    <select class="injectLocationSelect">
                        <option value="head">Head</option>
                        <option value="body">Body</option>
                    </select>
                </div>
                <div class="edit">
                    <button class="btn edit-btn">Edit File</button>
                </div>
                <div class="switch"></div>
                <div class="delete">
                    <button class="btn sym-btn">&#215</button>
                </div>
            </div>
        </template>

        <template id="headerRuleTemplate">
            <div class="ruleContainer headerRule">
                <div class="handle">
                    <div class="arrow-up"></div><div class="arrow-down"></div>
                </div>
                <div class="ruleType">For:</div>
                <div class="rule">
                    <input type="input" class="matchInput" placeholder="Match URL">
                </div>
                <div class="rule">
                    <input type="input" class="requestRules headerRuleInput" placeholder="Request Headers (click to edit)" readonly="">
                </div>
                <div class="rule">
                    <input type="input" class="responseRules headerRuleInput" placeholder="Response Headers (click to edit)" readonly="">
                </div>
                <div class="edit">
                    <button class="btn edit-btn">Edit Headers</button>
                </div>
                <div class="switch"></div>
                <div class="delete">
                    <button class="btn sym-btn">&#215</button>
                </div>
            </div>
        </template>

        <template id="headerEditorRuleTemplate">
            <div class="ruleContainer headerEditorRule">
                <div class="operation">
                    <select class="operationSelect">
                        <option value="set">Set</option>
                        <option value="remove">Remove</option>
                    </select>
                </div>
                <div class="headerLabel">Header:</div>
                <div class="headerInputContainer">
                    <input type="input" class="headerName" placeholder="Header">
                </div>
                <div class="valueLabel">Value:</div>
                <div class="headerInputContainer">
                    <input type="input" class="headerValue" placeholder="Value">
                </div>
                <div class="delete">
                    <button class="btn sym-btn">&#215</button>
                </div>
            </div>
        </template>

        <div class="clearfix"></div>

        <div id="domainDefs"></div>

        <!-- Hidden by CSS but required by legacy code -->
        <div id="addDomain">
            <button id="addDomainBtn" class="btn">Add Tab Group</button>
        </div>

        <div id="addRuleDropdown">
            <button id="addWebRuleBtn" class="btn" title="Redirect resources to other URLs">URL <span>&rarr;</span> URL</button>
            <button id="addFileRuleBtn" class="btn" title="Redirect resources to a file you make">URL <span>&rarr;</span> File</button>
            <button id="addInjectRuleBtn" class="btn" title="Inject content on a page">Inject File</button>
            <button id="addHeaderRuleBtn" class="btn" title="Modify request or response headers">Change Headers</button>
        </div>

        <div id="editorOverlay" class="overlay">
            <div id="editorOptions">
                <div class="editorHeader">
                    <div class="titleContainer">
                        <span id="editLabel" class="bold">Editing file for match:</span> <span id="matchContainer" class="allowTextBreaks"></span>
                    </div>
                    <div class="settingsContainer">
                        Syntax:
                        <select id="syntaxSelect">
                            <option value="html">HTML</option>
                            <option value="javascript">JavaScript</option>
                            <option value="css">CSS</option>
                            <option value="xml">XML</option>
                        </select>
                    </div>
                    <div class="beautifyContainer">
                        <button id="findInEditor" class="btn">Find</button>
                        <button id="beautifyJS" class="btn">Beautify JS</button>
                    </div>
                </div>
                <div class="loadContainer">
                    <select id="loadSelect"></select>
                </div>
            </div>
            <div id="editor"></div>
            <div id="editorFooter">
                <div class="left"><button id="fileCancelBtn" class="btn">Cancel</button></div>
                <div class="right"><button id="fileSaveAndCloseBtn" class="btn">Save &amp; Close</button></div>
                <div class="right"><button id="fileSaveBtn" class="btn">Save</button></div>
            </div>
        </div>

        <div id="headerRuleOverlay" class="overlay">
            <div id="headerRuleOptions">
                <div class="titleContainer">
                    <span id="headerEditLabel" class="bold">Editing headers for match:</span> <span id="headerMatchContainer" class="allowTextBreaks"></span>
                </div>
                <div class="presetsContainer">
                    Presets:
                    <select id="headerPresetsSelect">
                        <option value="">--- Select ---</option>
                        <option value="cors">Enable CORS</option>
                        <option value="allowFrames">Allow Frames</option>
                        <option value="allowContent">Allow Outside Content</option>
                        <option value="noInline">Disable Inline Scripts</option>
                    </select>
                </div>
            </div>
            <div class="headerRequestRules">
                <h2>Request Headers</h2>
                <div id="headerRequestRulesContainer"></div>
                <button id="addRequestHeaderBtn" class="btn">Add Request Header Rule</button>
            </div>
            <div class="headerResponseRules">
                <h2>Response Headers</h2>
                <div id="headerResponseRulesContainer"></div>
                <button id="addResponseHeaderBtn" class="btn">Add Response Header Rule</button>
            </div>
            <div id="headerRuleFooter">
                <div class="right"><button id="closeHeaderRuleEditorBtn" class="btn">Close</button></div>
            </div>
        </div>

        <div id="helpOverlay">
            <div id="helpContent">
                <h1>Help</h1>
                <p>View youtube help video <a href="https://www.youtube.com/watch?v=62QIWAP9mMM" target="_blank">HERE</a>.</p>
                <p style="color: red">Sometimes browser cache can stop overrides from working! Try reloading while holding shift or empty your cache!</p>
                <p>This extension exists to help you gain full control of any website by redirecting traffic, replacing, editing, or inserting new content. It does this by comparing url "match rules" to the current tab url and then individual resource urls. If the urls match, then the rules are applied.</p>
                <p>Rules are put into "Tab Groups". A Tab Group has a URL text field that acts as the match pattern for Chrome's current tab. Rules inside the Tab Group wont apply unless the match is successful. This is a good way to make sure overrides only happen on a certain website.</p>
                <h3>Example Tab URL Matches:</h3>
                <table>
                <tr><td><b>Tab Match URL</b></td><td></td><td><b>Browser Tab URL</b></td></tr>
                <tr><td>http://www.example.com/</td><td>matches</td><td>http://www.example.com/</td></tr>
                <tr><td>http://www.example.com/*</td><td>matches</td><td>http://www.example.com/some/path/info.txt</td></tr>
                <tr><td>*example*</td><td>matches</td><td>https://www.something.com/example/in/path</td></tr>
                <tr><td>*://www.example*/other/*</td><td>matches</td><td>https://www.example.org/some/other/path</td></tr>
                <tr><td>*</td><td>matches</td><td>&lt;Any URL Here&gt;</td></tr>
                </table>
                <p>Rules use the same star syntax. Web rules get an extra ability with stars (more on that below).</p>
                <p>A <b>Rule</b> can come in four different types:</p>
                <ul>
                    <li><b>URL &rarr; URL</b>: Every request url is compared with the <i>Match URL</i> and then transformed into the <i>Replace URL</i> if the match is successful.</li>
                    <li><b>URL &rarr; File</b>: Every request url is compared with the <i>Match URL</i>. If the match succeeds, a file you create is supplied as the response.</li>
                    <li><b>Inject File</b>: A file you create will be injected into the page as a JS or CSS document.</li>
                    <li><b>Change Headers</b>: Modify request or response headers.</li>
                </ul>
                <p>Each resource can only be changed by the first rule that matches it, so rules higher on the page have more precedence. You can rearrange rules by dragging on the up and down triangles.</p>
                <h3>Example URL &rarr; URL Patterns:</h3>
                <p>Text highlighted in <span class='blue-hl'>blue</span> is "captured" in *'s.</p>
                <table>
                <tr><td><b>Match URL</b></td><td><b>Replace URL</b></td><td><b>Resource URL</b></td><td></td><td><b>Result URL</b></td></tr>
                <tr><td>http://www.ex.com/neat.js</td><td>http://local:8080/cool.js</td><td>http://www.ex.com/neat.js</td><td class="rarrow">&rarr;</td><td>http://local:8080/cool.js</td></tr>
                <tr><td>http://www.ex.com/js/*</td><td>http://local:8080/all.js</td><td>http://www.ex.com/js/<span class='blue-hl'>some.js</span></td><td class="rarrow">&rarr;</td><td>http://local:8080/all.js</td></tr>
                <tr><td>http://www.ex.com/*.js</td><td>http://local:8080/*.js</td><td>http://www.ex.com/<span class='blue-hl'>captured_in_star</span>.js</td><td class="rarrow">&rarr;</td><td>http://local:8080/captured_in_star.js</td></tr>
                <tr><td>http://*.ex.com/*</td><td>http://*.local:8080/*</td><td>http://<span class='blue-hl'>other</span>.ex.com/<span class='blue-hl'>second_capture.js</span></td><td class="rarrow">&rarr;</td><td>http://other.local:8080/second_capture.js</td></tr>
                <tr><td>*/js/**.js</td><td>http://local:8080/code/**.js</td><td><span class='blue-hl'>http://any.com</span>/js/<span class='blue-hl'>2stars</span>.js</td><td class="rarrow">&rarr;</td><td>http://local:8080/code/2stars.js</td></tr>
                <tr><td>http://ex.com/*/**/***.js</td><td>http://local:8080/**/*/***.js</td><td>http://ex.com/<span class='blue-hl'>a</span>/<span class='blue-hl'>b</span>/<span class='blue-hl'>c</span>.js</td><td class="rarrow">&rarr;</td><td>http://local:8080/b/a/c.js</td></tr>
                </table>
                <p>When using the <i>URL &rarr; URL</i> rule, you can "store" parts of the resource URL in stars (*) and then reuse the stored part in the replace url with the same number of stars. Stars can capture parts of the url more than once - each new capture is put into a "queue" (See the 3rd to last example). If you need to be specific where stored parts of the url are placed, you can use multiple stars together (**) to 'create another variable'. You can also use this technique to throw away parts of a url you don't care about (you don't have to use the corresponding stars in the replace url). Examples of these can be seen in the above table.</p>
                <h3>Tips and Tricks</h3>
                <p>I highly recommend that you use this extension through Chrome's dev tools panel (right click somewhere on a page and click "Inspect". Then go to the "Overrides" tab). The dev tools view can help you make your url match rules correctly with a suggest feature.</p>
                <p>Do you need to override https content with a URL &rarr; URL rule and content on your computer? Make sure you have an https server! Also make sure that if ajax calls are being used that your https server has CORS turned on. Finally, don't forget to check that you can browse to your https content and "Proceed Anyway" if chrome yells at you about an untrusted certificate (Or you can just add the certificate to your system's trusted certificates). I like to use <a target="_blank" href="https://github.com/kylepaulsen/http-server">this</a> http(s) server (it auto generates ssl certificates and has CORS turned on by default).</p>
                <p>If you are having trouble getting a rule to work, try turning on the logs (click the options button at the top of this page and check "Show Logs"). Then reload the page and look in Chrome's console for the url you are trying to match. If a match succeeds, the <span class="blue-hl">text highlight will be blue</span>. If all else fails, try to make your rule less strict: *something* &lt;-- In this case, "something" just has to show up somewhere in the url.</p>
                <p>A URL &rarr; File rule needs to be paired with a mime type. This extension tries to guess the correct mime type based off of the resource url and the content you supply. If your files aren't loading and Chrome is giving you trouble about content arriving with the wrong mime type, it means that this extension couldn't automatically detect the correct mime type and you may need to provide it yourself. Here is an example of how to do this: If you have a JavaScript file, you would put <span style="font-family: courier">/* mime: text/javascript */</span> on the very first line of the file. You can force any mime type you want as long as it's on the very first line of the file and in that format.</p>
                <p>If you think you've found a bug and want to report it, please create an issue on the github page here: <a target="_blank" href="https://github.com/kylepaulsen/ResourceOverride">https://github.com/kylepaulsen/ResourceOverride</a>. I am much, much more likely to see bug reports there than on the Web Store (they don't have email alerts). Also feel free to contribute if you'd like. :)</p>
            </div>
            <div id="helpFooter">
                <div class="right"><button id="helpCloseBtn" class="btn">Close</button></div>
            </div>
        </div>

        <div id="tabPageNotice" class="toast">
        The devtools tab has more features that aren't avilable on the options page. <a href="#">OK</a>
        </div>

        <div id="generalToast" class="toast"></div>
      </div>
    </div>

    <!-- Add Rule Form View -->
    <div v-show="showAddRuleForm" class="add-rule-view">
      <div class="add-rule-form">
        <h2 class="form-title">Add New URL Redirect</h2>
        <div>
            <label>Source URL Pattern</label>
            <input type="text" v-model="newRuleSource" placeholder="/https:\/\/example\.com\/(.*)/" class="form-input">
        </div>
        <div>
            <label>Destination URL</label>
            <input type="text" v-model="newRuleDest" placeholder="https://localhost:8081/$1" class="form-input">
        </div>
      </div>
    </div>

    <!-- Fixed Footer -->
    <div class="fixed-footer">
      <template v-if="!showAddRuleForm">
        <button class="action-btn" @click="showAddRuleForm = true">Add Rule</button>
        <button class="action-btn" @click="handleImport">Import</button>
        <button class="action-btn" @click="handleExport">Export</button>
        <button class="action-btn" @click="handleHelp">Help</button>
      </template>
      <template v-else>
        <button class="action-btn" @click="showAddRuleForm = false; newRuleSource=''; newRuleDest=''">Back</button>
        <button class="action-btn primary-btn" @click="saveNewRule">Save</button>
      </template>
      
      <!-- Hidden file input for import -->
      <input type="file" id="fileInput" accept=".json" style="display: none;">
    </div>
  </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import AppHeader from './components/AppHeader.vue';

const activeTab = ref('redirects');
const showAddRuleForm = ref(false);
const newRuleSource = ref('');
const newRuleDest = ref('');

const saveNewRule = () => {
    const matchUrl = newRuleSource.value.trim();
    const replaceUrl = newRuleDest.value.trim();

    if (!matchUrl || !replaceUrl) {
        alert("Both Source and Destination URLs are required.");
        return;
    }

    const newRule = {
        match: matchUrl,
        replace: replaceUrl,
        type: "normalOverride",
        on: true
    };

    chrome.runtime.sendMessage({ action: "getDomains" }, (domains) => {
        let globalDomain = domains.find(d => d.matchUrl === "*");
        
        if (globalDomain) {
            globalDomain.rules = globalDomain.rules || [];
            globalDomain.rules.push(newRule);
        } else {
            // Determine next ID
            let maxId = 0;
            domains.forEach(d => {
                const num = parseInt(d.id.substring(1), 10);
                if (!isNaN(num) && num > maxId) {
                    maxId = num;
                }
            });
            const nextId = "d" + (maxId + 1);

            globalDomain = {
                id: nextId,
                matchUrl: "*",
                on: true,
                rules: [newRule]
            };
        }

        chrome.runtime.sendMessage({ action: "saveDomain", data: globalDomain }, () => {
            newRuleSource.value = "";
            newRuleDest.value = "";
            showAddRuleForm.value = false;
            // Force legacy UI to reload
            if (window.app && window.app.skipNextSync !== undefined) {
               window.app.skipNextSync = false;
               chrome.runtime.sendMessage({action: "dataUpdated"});
            } else {
               window.location.reload();
            }
        });
    });
};

const handleImport = () => {
    document.getElementById('fileInput')?.click();
};

const handleExport = () => {
    if (window.app && window.app.exportRules) {
        window.app.exportRules();
    }
};

const handleHelp = () => {
    const helpOverlay = document.getElementById('helpOverlay');
    if (helpOverlay) {
        helpOverlay.style.display = 'block';
    }
};

onMounted(async () => {
    await nextTick();
    // Setup import file input listener
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (Array.isArray(data)) {
                        chrome.runtime.sendMessage({ action: "import", data: data }, () => {
                            alert("Rules imported successfully!");
                            window.location.reload();
                        });
                    } else {
                        alert("Invalid JSON format. Expected an array of domains.");
                    }
                } catch (err) {
                    alert("Failed to parse JSON file.");
                }
            };
            reader.readAsText(file);
            fileInput.value = "";
        });
    }

    // Handle export manually since we bypassed OptionsPanel
    window.app = window.app || {};
    window.app.exportRules = () => {
        chrome.runtime.sendMessage({ action: "getDomains" }, (domains) => {
            const exportData = JSON.stringify(domains, null, 4);
            const blob = new Blob([exportData], { type: "text/plain" });
            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = "ResourceOverrideRules.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        });
    };

    // Dynamically import legacy UI scripts sequentially to preserve order
    await import('./ui/init.js');
    if (window.initLegacyUI) {
        window.initLegacyUI();
    }
    await import('./ui/util.js');
    await import('./ui/onOffSwitch.js');
    await import('./ui/headers.js');
    await import('./ui/moveableRules.js');
    await import('./ui/suggest.js');
    await import('./ui/editor.js');
    await import('./ui/headerEditor.js');
    await import('./ui/webRule.js');
    await import('./ui/fileRule.js');
    await import('./ui/injectRule.js');
    await import('./ui/headerRule.js');
    await import('./ui/tabGroup.js');
    await import('./ui/importExport.js');
    await import('./ui/devtoolstab.js');
});
</script>

<style>
/* Base styles */
body { 
    font-family: sans-serif; 
    background-color: #f5f6f8; 
    margin: 0; 
    padding: 0; 
    width: 750px; /* Force popup width */
    height: 550px; /* Force popup height */
}

.tabs-container {
  display: flex;
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.tab:hover {
  background-color: #f7fafc;
}

.tab.active {
  color: #ffffff;
  background-color: #3b82f6;
  border-bottom-color: #2563eb;
}

.tab-content-header {
  padding: 24px 32px 0 32px;
}

.tab-content-header h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
}

.tab-content-header p {
  margin: 0 0 16px 0;
  color: #718096;
}

#vue-root {
  width: 100%;
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

#legacy-ui-container {
  padding: 0 32px 32px 32px;
}

/* Hide Domain Group Header & Add Domain Button completely */
.domainHeader, #addDomain, #addRuleDropdown {
  display: none !important;
}

/* Make domain containers look flat */
.domainContainer {
  margin-bottom: 0 !important;
}
.overrideRules {
  margin: 0 !important;
}

/* Fixed Footer Styling */
.fixed-footer {
  flex-shrink: 0;
  background-color: #ffffff;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-around;
  padding: 12px;
  z-index: 100;
}

.fixed-footer .action-btn {
  background: none;
  border: none;
  color: #333;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.fixed-footer .action-btn:hover {
  background-color: #f0f0f0;
}

/* Tab Filtering Logic */

/* 1. URL Redirects Tab: Show normalOverride, hide others */
.tab-redirects .ruleContainer:not(.normalOverride) {
  display: none !important;
}

/* 2. Headers Tab: Show headerRule, hide others */
.tab-headers .ruleContainer:not(.headerRule) {
  display: none !important;
}

/* 3. CSS/JS Injection Tab: Show fileOverride and fileInject, hide others */
.tab-injections .ruleContainer.normalOverride,
.tab-injections .ruleContainer.headerRule {
  display: none !important;
}

/* Hide Domain Groups if they are completely empty for the active tab */
.tab-redirects .domainContainer:not(:has(.ruleContainer.normalOverride)) {
  display: none;
}
.tab-headers .domainContainer:not(:has(.ruleContainer.headerRule)) {
  display: none;
}
.tab-injections .domainContainer:not(:has(.ruleContainer.fileOverride)):not(:has(.ruleContainer.fileInject)) {
  display: none;
}

/* Add Rule Form Styles */
.add-rule-view {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 40px;
  background-color: #f5f6f8;
}

.add-rule-form {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-title {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #2b6cb0;
}

.add-rule-form label {
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  display: block;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  height: 36px;
  padding: 8px 12px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

.primary-btn {
  background-color: #3b82f6 !important;
  color: white !important;
}

.primary-btn:hover {
  background-color: #2563eb !important;
}
</style>
