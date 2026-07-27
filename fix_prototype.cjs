const fs = require('fs');
const path = '/Users/karlsome/Documents/GitHub/freyaAdmin2/src/pages/PrototypePage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Rename dxfFile, pdfFile states
content = content.replace(/const \[dxfFile, setDxfFile\] = useState\(null\);/g, 'const [dxfFiles, setDxfFiles] = useState([]);');
content = content.replace(/const \[pdfFile, setPdfFile\] = useState\(null\);/g, 'const [pdfFiles, setPdfFiles] = useState([]);');

// 2. Remove dxfFileName and pdfFileName
content = content.replace(/const dxfFileName = useMemo[^;]+;/g, '');
content = content.replace(/const pdfFileName = useMemo[^;]+;/g, '');

// 3. Update useEffect for renaming files based on form.shisakuNo
content = content.replace(/useEffect\(\(\) => \{\s+setPceFiles\(\(current\) => current.map\(\(entry\) => \(\s+entry.touched \? entry : \{ \.\.\.entry, name: buildFileName\(form.shisakuNo, entry.file.name\) \}\s+\)\)\);\s+\}, \[form.shisakuNo\]\);/g, `
  useEffect(() => {
    const renameFn = (current) => current.map((entry) => (
      entry.touched || !entry.file ? entry : { ...entry, name: buildFileName(form.shisakuNo, entry.file.name) }
    ));
    setDxfFiles(renameFn);
    setPdfFiles(renameFn);
    setPceFiles(renameFn);
  }, [form.shisakuNo]);
`);

// 4. Update file selection handlers
content = content.replace(/function handleFileSelect[^}]+}/g, `
  function createFilesAddHandler(setter) {
    return (files) => {
      if (!files?.length) return;
      setter((current) => [
        ...current,
        ...files.map((file) => ({
          id: \`\${Date.now()}-\${Math.random().toString(36).slice(2)}\`,
          file,
          name: buildFileName(form.shisakuNo, file.name),
          touched: false,
        })),
      ]);
    };
  }
  
  function createFileRemoveHandler(setter) {
    return (id) => setter((current) => current.filter((entry) => entry.id !== id));
  }
  
  function createFileRenameHandler(setter) {
    return (id, name) => setter((current) => current.map((entry) => (
      entry.id === id ? { ...entry, name, touched: true } : entry
    )));
  }

  const handleDxfFilesAdd = createFilesAddHandler(setDxfFiles);
  const handleDxfFileRemove = createFileRemoveHandler(setDxfFiles);
  const handleDxfFileRename = createFileRenameHandler(setDxfFiles);

  const handlePdfFilesAdd = createFilesAddHandler(setPdfFiles);
  const handlePdfFileRemove = createFileRemoveHandler(setPdfFiles);
  const handlePdfFileRename = createFileRenameHandler(setPdfFiles);

  const handlePceFilesAdd = createFilesAddHandler(setPceFiles);
  const handlePceFileRemove = createFileRemoveHandler(setPceFiles);
  const handlePceFileRename = createFileRenameHandler(setPceFiles);
`);

// Remove old PCE handlers
content = content.replace(/function handlePceFilesAdd[^}]+}/g, '');
content = content.replace(/function handlePceFileRemove[^}]+}/g, '');
content = content.replace(/function handlePceFileRename[^}]+}/g, '');

// 5. Update resetForm
content = content.replace(/setDxfFile\(null\);/g, 'setDxfFiles([]);');
content = content.replace(/setPdfFile\(null\);/g, 'setPdfFiles([]);');

// 6. Update canRegister
content = content.replace(/!!dxfFile && !!pdfFile &&\s+!!dxfFileName && !!pdfFileName &&/g, 'dxfFiles.length > 0 && dxfFiles.every(e => e.name.trim()) && pdfFiles.length > 0 && pdfFiles.every(e => e.name.trim()) &&');

// 7. Update handleRegister
content = content.replace(/const \[dxfBase64, pdfBase64, pdfImageDataUrl, \.\.\.pceBase64List\] = await Promise.all\(\[\s+toBase64\(dxfFile\),\s+toBase64\(pdfFile\),\s+convertPdfFileToPreviewImage\(pdfFile\),\s+\.\.\.pceFiles.map\(\(entry\) => toBase64\(entry.file\)\),\s+\]\);\s+const pdfImageBase64 = pdfImageDataUrl.split\(\",\"\)\[1\] \|\| \"\";/g, `
      const dxfBase64List = await Promise.all(dxfFiles.map(e => toBase64(e.file)));
      const pdfBase64List = await Promise.all(pdfFiles.map(e => toBase64(e.file)));
      const pdfImageUrls = await Promise.all(pdfFiles.map(e => convertPdfFileToPreviewImage(e.file)));
      const pceBase64List = await Promise.all(pceFiles.map(e => toBase64(e.file)));
`);

content = content.replace(/dxfFile: \{ name: dxfFileName, base64: dxfBase64 \},/g, 'dxfFiles: dxfFiles.map((e, i) => ({ name: e.name.trim(), base64: dxfBase64List[i] })),');
content = content.replace(/pdfFile: \{ name: pdfFileName, base64: pdfBase64 \},/g, 'pdfFiles: pdfFiles.map((e, i) => ({ name: e.name.trim(), base64: pdfBase64List[i] })),');
content = content.replace(/pdfImageFile: \{ name: buildJpgFileName\(pdfFileName\), base64: pdfImageBase64 \},/g, 'pdfImageFiles: pdfFiles.map((e, i) => ({ name: buildJpgFileName(e.name.trim()), base64: (pdfImageUrls[i] || "").split(",")[1] || "" })),');

// 8. Update JSX for form uploads
content = content.replace(/<SingleFileUpload[\s\S]*?disabled={!shisakuNoEntered}\s+\/>/g, `
              <FileUploadList
                label="DXF"
                accept=".dxf"
                files={dxfFiles}
                onAdd={handleDxfFilesAdd}
                onRemove={handleDxfFileRemove}
                onRename={handleDxfFileRename}
                disabled={!shisakuNoEntered}
              />
`);

content = content.replace(/<SingleFileUpload[\s\S]*?editable\s+\/>/g, `
              <FileUploadList
                label="PDF"
                accept=".pdf"
                files={pdfFiles}
                onAdd={handlePdfFilesAdd}
                onRemove={handlePdfFileRemove}
                onRename={handlePdfFileRename}
                disabled={!shisakuNoEntered}
              />
`);

content = content.replace(/<PceUploadList/g, '<FileUploadList');

fs.writeFileSync(path, content, 'utf8');
console.log('done');
