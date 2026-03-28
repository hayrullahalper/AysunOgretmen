import React, { useState, useEffect } from 'react';
import { firestoreService, Student } from '../lib/firestore';
import { UserPlus, Trash2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');

  useEffect(() => {
    const unsubscribe = firestoreService.getStudents(setStudents);
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !surname) return;
    
    const formatName = (str: string) => 
      str.trim().split(' ').map(word => 
        word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR')
      ).join(' ');

    const newStudent: Student = {
      id: crypto.randomUUID(),
      name: formatName(name),
      surname: formatName(surname),
      ownerId: '' // Set by service
    };
    
    await firestoreService.saveStudent(newStudent);
    setName('');
    setSurname('');
  };

  const handleDelete = async (id: string) => {
    await firestoreService.deleteStudent(id);
  };

  return (
    <div className="space-y-6">
      <div className="glass p-6 rounded-3xl border-slate-700 shadow-sm bg-slate-800/70">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-primary">
          <UserPlus className="text-primary" /> Yeni Öğrenci Ekle
        </h2>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field border-slate-700 bg-slate-800 text-white"
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Soyadı"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="input-field border-slate-700 bg-slate-800 text-white"
            />
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap shadow-md hover:shadow-lg transition-shadow">Ekle</button>
        </form>
      </div>

      <div className="glass p-6 rounded-3xl border-slate-700 shadow-sm bg-slate-800/70">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-secondary">
          <Users className="text-secondary" /> Öğrenci Listesi ({students.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {students.map((student) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="p-4 bg-slate-800 rounded-2xl shadow-sm flex justify-between items-center border border-slate-700 hover:border-primary hover:bg-slate-700 transition-all group"
              >
                <div className="truncate mr-2">
                  <p className="font-bold text-lg truncate text-slate-100">{student.name} {student.surname}</p>
                </div>
                <button
                  onClick={() => handleDelete(student.id)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-900/20 rounded-full transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={20} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {students.length === 0 && (
            <p className="col-span-full text-center text-slate-400 py-8 font-medium italic">Henüz öğrenci eklenmemiş.</p>
          )}
        </div>
      </div>
    </div>
  );
}
