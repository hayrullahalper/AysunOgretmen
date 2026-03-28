import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportToPDF = async (title: string, content: any, type: 'quiz' | 'story') => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = margin;

  const createEl = (html: string, width = 800) => {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    el.style.width = `${width}px`;
    el.style.padding = '20px';
    el.style.backgroundColor = '#ffffff';
    el.style.color = '#1a1a1a';
    el.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    // Reset any inherited oklch colors
    el.style.borderColor = '#e2e8f0';
    el.innerHTML = `
      <style>
        * { box-sizing: border-box; color: #1a1a1a !important; border-color: #e2e8f0 !important; }
        h1 { color: #3f51b5 !important; font-size: 24px; margin-bottom: 5px; }
        h2 { color: #334155 !important; font-size: 18px; margin-bottom: 15px; }
        h3 { color: #475569 !important; font-size: 16px; border-bottom: 2px solid #3f51b5; padding-bottom: 5px; margin-top: 20px; }
        .story-text { line-height: 1.8; font-size: 14px; text-align: justify; color: #334155 !important; }
        .question-block { margin-bottom: 15px; padding: 10px; background-color: #f8fafc; border-radius: 8px; }
        .dashed-line { border-bottom: 1px dashed #cbd5e1 !important; }
      </style>
      ${html}
    `;
    document.body.appendChild(el);
    return el;
  };

  const addBlockToPDF = async (el: HTMLElement) => {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pdfWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (currentY + imgHeight > pdfHeight - margin) {
      pdf.addPage();
      currentY = margin;
    }

    pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
    currentY += imgHeight + 5;
    document.body.removeChild(el);
  };

  // Header
  const headerHtml = `
    <div style="text-align: center; border-bottom: 2px solid #eeeeee; padding-bottom: 10px; margin-bottom: 10px;">
      <h1 style="font-size: 22px; color: #5c6bc0; margin: 0;">Aysun Öğretmen - Çalışma Kağıdı</h1>
      <h2 style="font-size: 18px; color: #333333; margin: 5px 0;">${title}</h2>
      <div style="display: flex; justify-content: space-between; margin-top: 15px; font-size: 12px; color: #666666;">
        <span>Tarih: ${new Date().toLocaleDateString('tr-TR')}</span>
        <span>İsim: ___________________________</span>
      </div>
    </div>
  `;
  await addBlockToPDF(createEl(headerHtml));

  if (type === 'story') {
    const storyHtml = `
      ${content.image ? `<img src="${content.image}" style="width: 100%; border-radius: 12px; margin-bottom: 25px; border: 1px solid #e2e8f0;" />` : ''}
      <div class="story-text">
        ${content.story.replace(/\n/g, '<br>')}
      </div>
    `;
    await addBlockToPDF(createEl(storyHtml));

    const questionsTitleHtml = `<h3>Okuma-Anlama Soruları</h3>`;
    await addBlockToPDF(createEl(questionsTitleHtml));

    for (let i = 0; i < content.questions.length; i++) {
      const q = content.questions[i];
      const qHtml = `
        <div class="question-block">
          <p style="font-weight: bold; margin: 0; font-size: 14px;">${i + 1}. ${q.question}</p>
          <div style="height: 35px; border-bottom: 1px dashed #cbd5e1; margin-top: 8px;"></div>
        </div>
      `;
      await addBlockToPDF(createEl(qHtml));
    }
  } else {
    // Restore 2-column layout for quizzes by rendering pairs
    const questions = content.questions;
    for (let i = 0; i < questions.length; i += 2) {
      const q1 = questions[i];
      const q2 = questions[i + 1];
      
      const rowHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 800px;">
          <div style="padding: 15px; border: 1px solid #f0f0f0; border-radius: 10px;">
            <p style="font-weight: bold; margin-bottom: 10px; font-size: 14px;">${i + 1}. ${q1.question}</p>
            ${q1.options && q1.options.length > 0 ? `
              <div style="font-size: 12px; display: grid; grid-template-columns: 1fr; gap: 5px;">
                ${q1.options.map((opt: string, j: number) => `
                  <div>${String.fromCharCode(65 + j)}) ${opt}</div>
                `).join('')}
              </div>
            ` : `
              <div style="height: 30px; border-bottom: 1px dashed #cccccc; margin-top: 10px;"></div>
            `}
          </div>
          ${q2 ? `
            <div style="padding: 15px; border: 1px solid #f0f0f0; border-radius: 10px;">
              <p style="font-weight: bold; margin-bottom: 10px; font-size: 14px;">${i + 2}. ${q2.question}</p>
              ${q2.options && q2.options.length > 0 ? `
                <div style="font-size: 12px; display: grid; grid-template-columns: 1fr; gap: 5px;">
                  ${q2.options.map((opt: string, j: number) => `
                    <div>${String.fromCharCode(65 + j)}) ${opt}</div>
                  `).join('')}
                </div>
              ` : `
                <div style="height: 30px; border-bottom: 1px dashed #cccccc; margin-top: 10px;"></div>
              `}
            </div>
          ` : '<div style="flex: 1;"></div>'}
        </div>
      `;
      await addBlockToPDF(createEl(rowHtml));
    }
  }

  pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
};
