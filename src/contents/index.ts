import type { PlasmoCSConfig } from "plasmo";

import type { Settings } from "~lib/types";

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.console.aws.amazon.com/*",
    "https://*.awsapps.com/*",
    "https://*.signin.aws.amazon.com/*",
    "https://health.aws.amazon.com/*"
  ],
  all_frames: true,
  run_at: "document_end",
  css: ["styles.css"]
};

export const annotatePatterns = {
  arn: [
    "arn:(aws[a-zA-Z-]*)?:([a-zA-Z0-9-\\.\\_]*):([a-zA-Z0-9-\\.\\_]*):(.*):(.*)"
  ],
  accountId: ["\\d{12}", "\\d{4}-\\d{4}-\\d{4}"],
  accessKeyId: ["(?:ASIA|AKIA|AROA|AIDA)([A-Z0-7]{16})"],
  secretAccessKey: ["[a-zA-Z0-9+/]{40}"],
  organizationalUnit: ["ou-[a-zA-Z0-9-]{4,32}"],
  rootUnit: ["r-[a-zA-Z0-9]{4,32}"],
  email: ["[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"]
} as const;

chrome.runtime.sendMessage({ method: "GET_SETTINGS" }, (settings: Settings) => {
  _applySettings(settings);
  _setupObserver();
});

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.method === "UPDATE_SETTINGS") {
    const settings = message.settings as Settings;
    _applySettings(settings);
  }
});

const _applySettings = (settings: Settings) => {
  document.body.dataset.aws_masking_disabled = settings.disabled.toString();
  document.body.dataset.aws_masking_inputs = settings.maskInputs.toString();
  document.body.dataset.aws_masking_account_ids =
    settings.maskAccountIds.toString();
  document.body.dataset.aws_masking_arns = settings.maskArns.toString();
  document.body.dataset.aws_masking_access_key_ids =
    settings.maskAccessKeyIds.toString();
  document.body.dataset.aws_masking_secret_access_keys =
    settings.maskSecretAccessKeys.toString();
  document.body.dataset.aws_masking_organizational_units =
    settings.maskOrganizationalUnits.toString();
  document.body.dataset.aws_masking_root_units =
    settings.maskRootUnits.toString();
  document.body.dataset.aws_masking_emails =
    settings.maskEmails.toString();
};

let observer: MutationObserver;

const _setupObserver = () => {
  if (observer) observer.disconnect();

  const observeConfig: MutationObserverInit = {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true
  };

  observer = new MutationObserver(() => {
    observer.disconnect();

    _annotateTexts(document.body);
    _observeInputs(document.body);

    observer.observe(document.body, observeConfig);
  });

  _annotateTexts(document.body);
  _observeInputs(document.body);
  observer.observe(document.body, observeConfig);
};

const _annotateTexts = (node: Element) => {
  if (node.nodeType !== Node.TEXT_NODE) {
    node.childNodes.forEach((child: Element) => _annotateTexts(child));
  } else {
    const mappings = {
      aws_masking_arn: annotatePatterns.arn,
      aws_masking_account_id: annotatePatterns.accountId,
      aws_masking_access_key_id: annotatePatterns.accessKeyId,
      aws_masking_secret_access_key: annotatePatterns.secretAccessKey,
      aws_masking_organizational_unit: annotatePatterns.organizationalUnit,
      aws_masking_root_unit: annotatePatterns.rootUnit,
      aws_masking_email: annotatePatterns.email
    };

    if (node.parentElement.dataset.aws_masking_arn === "true")
      delete mappings.aws_masking_arn;
    if (node.parentElement.dataset.aws_masking_account_id === "true")
      delete mappings.aws_masking_account_id;
    if (node.parentElement.dataset.aws_masking_access_key_id === "true")
      delete mappings.aws_masking_access_key_id;
    if (node.parentElement.dataset.aws_masking_secret_access_key === "true")
      delete mappings.aws_masking_secret_access_key;
    if (node.parentElement.dataset.aws_masking_organizational_unit === "true")
      delete mappings.aws_masking_organizational_unit;
    if (node.parentElement.dataset.aws_masking_root_unit === "true")
      delete mappings.aws_masking_root_unit;
    if (node.parentElement.dataset.aws_masking_email === "true")
      delete mappings.aws_masking_email;

    const nodeVal = node.nodeValue;
    const newElement = document.createElement("span");
    let lastIdx = 0;
    let matchFound = false;
    for (const [dataAttr, patterns] of Object.entries(mappings)) {
      for (const pattern of patterns) {
        const regexPattern = new RegExp(`\\b${pattern}\\b`, "g");
        let match: RegExpExecArray;
        while ((match = regexPattern.exec(nodeVal))) {
          const matchText = match[0];
          if (lastIdx !== match.index) {
            const nonMatchedText = document.createTextNode(
              nodeVal.slice(lastIdx, match.index)
            );
            newElement.appendChild(nonMatchedText);
          }
          const span = document.createElement("span");
          span.dataset[dataAttr] = "true";
          span.textContent = matchText;
          newElement.appendChild(span);
          lastIdx = regexPattern.lastIndex;
          matchFound = true;
        }
      }
      if (matchFound) break;
    }
    if (lastIdx < nodeVal.length) {
      const nonMatchedEndText = document.createTextNode(nodeVal.slice(lastIdx));
      newElement.appendChild(nonMatchedEndText);
    }
    if (matchFound) {
      node.parentElement.innerHTML = newElement.innerHTML;
    }
  }
};

const _handleChangeInput = (e: Event) => {
  _annotateInput(e.target as HTMLInputElement);
};

const _annotateInput = (input: HTMLInputElement) => {
  const value = input.value;

  const mappings = {
    aws_masking_arn: annotatePatterns.arn,
    aws_masking_account_id: annotatePatterns.accountId,
    aws_masking_access_key_id: annotatePatterns.accessKeyId,
    aws_masking_secret_access_key: annotatePatterns.secretAccessKey,
    aws_masking_organizational_unit: annotatePatterns.organizationalUnit,
    aws_masking_root_unit: annotatePatterns.rootUnit,
    aws_masking_email: annotatePatterns.email
  };

  for (const [dataAttr, patterns] of Object.entries(mappings)) {
    for (const pattern of patterns) {
      if (new RegExp(`\\b${pattern}\\b`, "g").test(value)) {
        input.dataset[dataAttr] = "true";
        return;
      }
    }
    input.dataset[dataAttr] = "false";
  }
};

const _observeInputs = (elem: Element) => {
  elem
    .querySelectorAll("input[type=text], input[type=search], textarea")
    .forEach((input: HTMLInputElement) => {
      input.removeEventListener("input", _handleChangeInput);
      input.addEventListener("input", _handleChangeInput);
      _annotateInput(input);
    });
};
