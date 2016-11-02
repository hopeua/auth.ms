import ShortId from 'shortid';
import Acl from 'common/utils/acl';
import Prepare from 'common/utils/prepareModel';
import { Hash } from 'common/utils/bcrypt';

/**
 * TODO Систематизировать запросы:
 * TODO beforeRemote – проверка авторизации
 * TODO remote – обработка запроса
 * TODO afterRemote – очистка результата от непубличных данных
 */
module.exports = (User) => {
    Prepare(User);

    User.toPublic = (user) => {
        user.passwordHash = undefined;
        return user;
    };

    /**
     * POST /users
     * Access: users.write
     */
    User.beforeRemote('create', async (ctx, user, next) => {
        try {
            if (!Acl.isGranted(ctx.req.user, 'users:write')) {
                const error = new Error('Access denied');
                error.statusCode = 401;
                return next(error);
            }
        } catch (error) {
            return next(error);
        }

        // Password hash gen
        const password = ctx.args.data.password;
        if (typeof password === 'string' && password.length > 0) {
            try {
                ctx.args.data.passwordHash = await Hash(password);
            } catch (error) {
                return next(error);
            }
        }

        next();
    });
    User.afterRemote('create', (ctx, user, next) => {
        ctx.result = User.toPublic(user);
        next();
    });
    User.observe('before save', async (ctx) => {
        // Создание нового пользователя, генерируем ID
        if (ctx.isNewInstance) {
            ctx.instance.id = ShortId.generate();
            ctx.instance.registrationDate = new Date();
        }

        // TODO редактирование пользователя

        return Promise.resolve();
    });

    /**
     * GET /users
     * Access: users.read
     */
    User.beforeRemote('getAll', async (ctx, data, next) => {
        try {
            if (!Acl.isGranted(ctx.req.user, 'users:read')) {
                const error = new Error('Access denied');
                error.statusCode = 401;
                return next(error);
            }
        } catch (error) {
            return next(error);
        }

        next();
    });
    User.afterRemote('getAll', async (ctx, data, next) => {
        if (ctx.result && Array.isArray(ctx.result)) {
            try {
                ctx.result.forEach(User.toPublic);
            } catch (error) {
                return next(error);
            }
        }

        next();
    });

    /**
     * GET /users/:id
     * Access: users.read
     */
    User.beforeRemote('getOne', async (ctx, data, next) => {
        try {
            if (!Acl.isGranted(ctx.req.user, 'users:read')) {
                const error = new Error('Access denied');
                error.statusCode = 401;
                return next(error);
            }
        } catch (error) {
            return next(error);
        }

        next();
    });
    User.afterRemote('getOne', async (ctx, data, next) => {
        if (ctx.result) {
            try {
                User.toPublic(ctx.result);
            } catch (error) {
                return next(error);
            }
        }

        next();
    });

    /**
     * GET /users/self
     */
    User.remoteMethod('self', {
        http: { verb: 'get', path: '/self'},
        accepts: {
            arg: 'req',
            type: 'object',
            http: { source: 'req' }
        },
        returns: { type: 'Object', root: true },
        isStatic: true
    });
    User.self = async (req) => {
        const user = req.user;
        if (user.id === '') {
            const error = new Error('Access denied');
            error.statusCode = 401;
            throw error;
        }

        return User.toPublic(user);
    };

    /**
     * DELETE /users/:id
     */
    User.beforeRemote('deleteById', async (ctx, user, next) => {
        try {
            if (!Acl.isGranted(ctx.req.user, 'users:write')) {
                const error = new Error('Access denied');
                error.statusCode = 401;
                return next(error);
            }
        } catch (error) {
            return next(error);
        }

        next();
    });

    /**
     * POST /users/:id/permissions
     * Access: users.write
     */
    User.remoteMethod('editPermissions', {
        http: { verb: 'post', path: '/permissions'},
        accepts: {
            arg: 'data',
            type: 'object',
            http: { source: 'body' }
        },
        returns: { type: 'Object', root: true },
        isStatic: false
    });
    User.beforeRemote('editPermissions', async (ctx, user, next) => {
        try {
            if (!Acl.isGranted(ctx.req.user, 'users:write')) {
                const error = new Error('Access denied');
                error.statusCode = 401;
                return next(error);
            }
        } catch (error) {
            return next(error);
        }

        next();
    });
    User.prototype.editPermissions = async function(permissions) {
        const user = this;

        user.permissions = permissions;
        await user.save();
        
        return User.toPublic(user);
    };
};
