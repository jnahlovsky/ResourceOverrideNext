export function globMatchToDNRRegex(glob) {
    if (!glob) return ".*";
    const escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    const parts = glob.split('*');
    let regexStr = "^";
    parts.forEach((part, index) => {
        regexStr += escapeRegex(part);
        if (index < parts.length - 1) {
            regexStr += ".*";
        }
    });
    regexStr += "$";
    return regexStr;
}