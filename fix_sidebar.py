import os

filepath = 'src/components/certificates/CompletionCertificateEditorSidebar.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { ChevronDown, Upload } from 'lucide-react';",
    "import { ChevronDown, Upload, User, Type, Image } from 'lucide-react';"
)

content = content.replace(
    "<div className={s.accordionTitle}>Дані</div>",
    "<div className={s.accordionTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={16} />Дані</div>"
)

content = content.replace(
    "<div className={s.accordionTitle}>Текстові блоки</div>",
    "<div className={s.accordionTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Type size={16} />Текстові блоки</div>"
)

content = content.replace(
    "<div className={s.accordionTitle}>Шаблон</div>",
    "<div className={s.accordionTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Image size={16} />Шаблон</div>"
)

with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print('Done replacing.')
