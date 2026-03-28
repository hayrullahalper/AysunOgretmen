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
    el.style.color = '#333333';
    el.style.fontFamily = 'Arial, sans-serif';
    // Reset any inherited oklch colors
    el.style.borderColor = '#eeeeee';
    el.innerHTML = `
      <style>
        * { box-sizing: border-box; color: #333333 !important; border-color: #eeeeee !important; }
        h1, h2, h3, h4 { color: #5c6bc0 !important; }
        .dashed-line { border-bottom: 1px dashed #cccccc !important; }
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
      <div style="line-height: 1.6; font-size: 15px; text-align: justify; margin-bottom: 20px;">
        ${content.story.replace(/\n/g, '<br>')}
      </div>
    `;
    await addBlockToPDF(createEl(storyHtml));

    const questionsTitleHtml = `<h3 style="font-size: 16px; border-bottom: 1px solid #eeeeee; padding-bottom: 5px;">Okuma-Anlama Soruları</h3>`;
    await addBlockToPDF(createEl(questionsTitleHtml));

    for (let i = 0; i < content.questions.length; i++) {
      const q = content.questions[i];
      const qHtml = `
        <div style="margin-bottom: 10px;">
          <p style="font-weight: bold; margin: 0;">${i + 1}. ${q.question}</p>
          <div style="height: 30px; border-bottom: 1px dashed #cccccc; margin-top: 5px;"></div>
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
